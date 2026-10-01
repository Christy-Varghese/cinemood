import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { logError } from "@/lib/logger";
import { getMovieBasics, getTrending } from "@/lib/tmdb/movies";
import type { MovieSummary } from "@/types/movie";

/**
 * "Old is gold" — older films that are suddenly getting attention again.
 *
 * Instagram, TikTok and Reels have no public trends API, so we measure the
 * ripple a viral clip leaves on open data instead:
 *   1. Wikipedia pageviews (Wikimedia REST, free, no key): the top ~1000
 *      English articles over the last few days → mapped to films via Wikidata
 *      (TMDB id P4947 + publication date P577) → compared to each film's own
 *      baseline, so we surface *spikes*, not evergreen classics.
 *   2. TMDB trending (day + week) filtered to films released 10+ years ago.
 * Nothing is invented: every badge shows the signal that put the film here.
 */

export const VINTAGE_MIN_AGE = 10;

export interface VintageSignal {
  /** Recent Wikipedia daily views ÷ the film's usual daily views. */
  wikiSpike?: number;
  /** Average daily English Wikipedia views over the last 3 days. */
  wikiViews?: number;
  /** Position in TMDB's trending list (1-based). */
  tmdbRank?: number;
}
export interface VintageItem {
  movie: MovieSummary;
  signal: VintageSignal;
  score: number;
}

const UA = { "User-Agent": `CineMood/1.0 (${env.appUrl}; movie discovery app)`, Accept: "application/json" };
const WM = "https://wikimedia.org/api/rest_v1/metrics/pageviews";

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const TopSchema = z.object({ items: z.array(z.object({ articles: z.array(z.object({ article: z.string(), views: z.number() })) })) });
const SKIP = /^(Main_Page|Special:|Wikipedia:|File:|Portal:|Help:|Talk:|Category:|Template:|User:|-$)/;

/** Top English Wikipedia articles, summed over the last few published days. */
async function topArticles(): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  // Wikimedia publishes a day's ranking a few hours after midnight UTC, so start 1 day back.
  const days = [1, 2, 3, 4];
  const res = await Promise.allSettled(
    days.map(async (n) => {
      const d = daysAgo(n).toISOString().slice(0, 10).split("-");
      const r = await fetch(`${WM}/top/en.wikipedia.org/all-access/${d[0]}/${d[1]}/${d[2]}`, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`Wikimedia top HTTP ${r.status}`);
      return TopSchema.parse(await r.json()).items[0]?.articles ?? [];
    }),
  );
  let used = 0;
  for (const s of res) {
    if (s.status !== "fulfilled" || used >= 3) continue;
    used++;
    for (const a of s.value) if (!SKIP.test(a.article)) totals.set(a.article, (totals.get(a.article) ?? 0) + a.views);
  }
  if (!used) throw new Error("No Wikimedia top lists available");
  return totals;
}

const SparqlSchema = z.object({
  results: z.object({ bindings: z.array(z.object({ title: z.object({ value: z.string() }), tmdb: z.object({ value: z.string() }), year: z.object({ value: z.string() }).optional() })) }),
});

/** Which of these Wikipedia titles are films, and what are their TMDB ids + release years. */
async function filmsForTitles(titles: string[]) {
  const esc = (t: string) => t.replace(/_/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const chunks: string[][] = [];
  for (let i = 0; i < titles.length; i += 200) chunks.push(titles.slice(i, i + 200));
  const out = new Map<string, { tmdbId: number; year: number | null }>();
  const settled = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const query = `SELECT ?title ?tmdb (MIN(YEAR(?date)) AS ?year) WHERE {
  VALUES ?title { ${chunk.map((t) => `"${esc(t)}"@en`).join(" ")} }
  ?article schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?film .
  ?film wdt:P4947 ?tmdb .
  OPTIONAL { ?film wdt:P577 ?date . }
} GROUP BY ?title ?tmdb`;
      const r = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { ...UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query, format: "json" }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error(`Wikidata HTTP ${r.status}`);
      return SparqlSchema.parse(await r.json()).results.bindings;
    }),
  );
  for (const s of settled) {
    if (s.status === "rejected") {
      logError("sources", "Wikidata film lookup failed", s.reason);
      continue;
    }
    for (const b of s.value) {
      const tmdbId = Number.parseInt(b.tmdb.value, 10);
      if (!Number.isFinite(tmdbId)) continue;
      out.set(b.title.value.replace(/ /g, "_"), { tmdbId, year: b.year ? Number.parseInt(b.year.value, 10) || null : null });
    }
  }
  return out;
}

const DailySchema = z.object({ items: z.array(z.object({ views: z.number() })) });
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Last-3-days average vs the film's own median over the previous ~5 weeks. */
async function spikeFor(article: string) {
  const r = await fetch(`${WM}/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(article)}/daily/${ymd(daysAgo(45))}00/${ymd(daysAgo(1))}00`, {
    headers: UA,
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Wikimedia per-article HTTP ${r.status}`);
  const views = DailySchema.parse(await r.json()).items.map((i) => i.views);
  if (views.length < 14) return null;
  const recent = views.slice(-3);
  const base = views.slice(0, -7);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  // Floor the baseline so obscure pages going from 20 → 200 views don't dominate.
  const ratio = recentAvg / Math.max(median(base), 400);
  return { ratio, recentAvg };
}

async function wikipediaRevival(cutoffYear: number): Promise<VintageItem[]> {
  const top = await topArticles();
  const titles = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1000).map(([t]) => t);
  const films = await filmsForTitles(titles);
  const old = [...films.entries()].filter(([, f]) => f.year !== null && f.year <= cutoffYear).slice(0, 60);

  const spikes = await Promise.allSettled(old.map(async ([article, f]) => ({ f, s: await spikeFor(article) })));
  const candidates = spikes
    .flatMap((s) => (s.status === "fulfilled" && s.value.s ? [{ tmdbId: s.value.f.tmdbId, ...s.value.s }] : []))
    .filter((c) => c.ratio >= 1.4)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 24);

  const hydrated = await Promise.allSettled(candidates.map((c) => getMovieBasics(c.tmdbId)));
  return hydrated.flatMap((h, i) => {
    if (h.status !== "fulfilled") return [];
    const c = candidates[i];
    return [{ movie: h.value, signal: { wikiSpike: Math.round(c.ratio * 10) / 10, wikiViews: Math.round(c.recentAvg) }, score: Math.log2(c.ratio) * 1.2 + 0.4 }];
  });
}

async function tmdbRevival(cutoffYear: number): Promise<VintageItem[]> {
  // Older films rarely crack TMDB's top 100, so look deeper: 8 pages of each window (~320 titles).
  const pages = await Promise.allSettled((["day", "week"] as const).flatMap((w) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => getTrending(w, p))));
  const seen = new Map<number, VintageItem>();
  let rank = 0;
  for (const p of pages) {
    if (p.status !== "fulfilled") continue;
    for (const m of p.value.results) {
      rank++;
      const y = m.releaseDate ? Number.parseInt(m.releaseDate.slice(0, 4), 10) : NaN;
      if (!(y <= cutoffYear) || seen.has(m.tmdbId)) continue;
      seen.set(m.tmdbId, { movie: m, signal: { tmdbRank: rank }, score: 1.4 - Math.min(rank, 320) / 320 });
    }
  }
  if (pages.every((p) => p.status === "rejected")) throw (pages[0] as PromiseRejectedResult).reason;
  return [...seen.values()];
}

async function computeVintage(): Promise<VintageItem[]> {
  const cutoff = new Date().getUTCFullYear() - VINTAGE_MIN_AGE;
  const [wiki, tmdbList] = await Promise.allSettled([wikipediaRevival(cutoff), tmdbRevival(cutoff)]);
  if (wiki.status === "rejected") logError("sources", "Wikipedia revival signal failed", wiki.reason);
  if (tmdbList.status === "rejected" && wiki.status === "rejected") throw tmdbList.reason;

  const merged = new Map<number, VintageItem>();
  for (const item of [...(wiki.status === "fulfilled" ? wiki.value : []), ...(tmdbList.status === "fulfilled" ? tmdbList.value : [])]) {
    const prev = merged.get(item.movie.tmdbId);
    if (!prev) merged.set(item.movie.tmdbId, item);
    else merged.set(item.movie.tmdbId, { movie: prev.movie, signal: { ...prev.signal, ...item.signal }, score: prev.score + item.score + 0.5 });
  }
  return [...merged.values()]
    .filter((v) => v.movie.posterPath) // a poster-less card isn't much of a discovery
    .sort((a, b) => b.score - a.score);
}

/** Cached for 6 hours across pages; the TMDB-not-configured error still propagates. */
export const getVintageTrending = unstable_cache(computeVintage, ["vintage-trending-v2"], { revalidate: 60 * 60 * 6, tags: ["vintage"] });

/** One-line, human explanation of why a film is in the list. */
export function vintageReason(v: VintageItem) {
  const y = v.movie.releaseDate?.slice(0, 4);
  const parts: string[] = [];
  if (v.signal.wikiSpike) parts.push(`Wikipedia views ↑ ${v.signal.wikiSpike.toFixed(1)}×`);
  if (v.signal.tmdbRank) parts.push("Trending on TMDB");
  if (y) parts.push(`from ${y}`);
  return parts.join(" · ");
}
