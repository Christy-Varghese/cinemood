import "server-only";
import { discover, getMovieBasics, getTrending, type DiscoverParams } from "@/lib/tmdb/movies";
import { genresForMood, ruleBasedProfile } from "@/lib/mood-engine/rules";
import { getActiveWeights, getStoredProfiles } from "@/lib/db/repository";
import { rank, type Candidate } from "./engine";
import { logError } from "@/lib/logger";
import { getTraktTrending } from "@/lib/sources/trakt";
import type { MovieSummary } from "@/types/movie";
import type { DiscoveryQuery, ScoredMovie, TasteProfile } from "@/types/recommendation";

/** Languages sampled when the user didn't pick one — this is what makes results global. */
const WORLD_SAMPLE = ["ko", "ja", "hi", "ml", "fr", "es", "ta", "it"];

function monetization(q: DiscoveryQuery): DiscoverParams["monetization"] {
  if (q.availability === "stream") return ["flatrate", "free", "ads"];
  if (q.availability === "rent") return ["rent"];
  if (q.availability === "buy") return ["buy"];
  return undefined;
}

/** Genres that typically carry the requested moods — used only to *retrieve*, never to rank. */
export function genreHints(q: DiscoveryQuery): number[] {
  const set = new Set<number>();
  for (const m of q.moods) genresForMood(m, 0.5).slice(0, 3).forEach((g) => set.add(g));
  return [...set];
}

/**
 * Stage 1 — candidate retrieval. Deterministic TMDB discover calls (cached),
 * pulling a pool of ~100-250 movies that satisfy the hard filters.
 */
/** `deck` walks deeper into TMDB's result pages so the Swipe tab never runs dry. */
export async function retrieveCandidates(q: DiscoveryQuery, deck = 0): Promise<MovieSummary[]> {
  const p1 = 1 + deck * 2;
  const p2 = 2 + deck * 2;
  const base: DiscoverParams = {
    genres: q.genres.length ? q.genres : genreHints(q),
    genreMode: q.genres.length ? "and" : "or",
    minYear: q.minYear,
    maxYear: q.maxYear,
    minRuntime: q.minRuntime,
    maxRuntime: q.maxRuntime,
    minRating: q.minRating,
    region: q.region ?? undefined,
    monetization: monetization(q),
  };

  const calls: Promise<{ results: MovieSummary[] }>[] = [];
  if (q.languages.length) {
    for (const language of q.languages) {
      // Regional cinema has fewer votes — relax the vote floor so hidden gems qualify.
      const minVotes = language === "en" ? 100 : 15;
      calls.push(discover({ ...base, language, minVotes, page: p1 }));
      calls.push(discover({ ...base, language, minVotes, page: p2 }));
      calls.push(discover({ ...base, language, minVotes: minVotes * 3, sortBy: "vote_average.desc", page: 1 + deck }));
    }
  } else {
    calls.push(discover({ ...base, minVotes: 300, page: p1 }));
    calls.push(discover({ ...base, minVotes: 300, page: p2 }));
    calls.push(discover({ ...base, minVotes: 800, sortBy: "vote_average.desc", page: 1 + deck }));
    for (const language of WORLD_SAMPLE) calls.push(discover({ ...base, language, minVotes: 40, page: 1 + deck }));
  }

  const settled = await Promise.allSettled(calls);
  const seen = new Set<number>();
  const pool: MovieSummary[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const m of s.value.results) {
      if (seen.has(m.tmdbId)) continue;
      seen.add(m.tmdbId);
      pool.push(m);
    }
  }
  // If every call failed, surface the error instead of returning an empty "no results".
  if (!pool.length && settled.every((s) => s.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  return pool;
}

async function profileAll(movies: MovieSummary[], keywords?: Map<number, string[]>): Promise<Candidate[]> {
  const stored = await getStoredProfiles(movies.map((m) => m.tmdbId));
  return movies.map((movie) => ({
    movie,
    profile:
      stored.get(movie.tmdbId) ??
      ruleBasedProfile({
        genreIds: movie.genreIds,
        overview: movie.overview,
        keywords: keywords?.get(movie.tmdbId),
        runtime: movie.runtime,
        voteAverage: movie.voteAverage,
      }),
  }));
}

/**
 * Full pipeline: retrieve → profile → rank → enrich top N (runtime, keywords,
 * countries) → re-profile with keywords → re-rank with diversity → explain.
 */
export async function recommend(
  q: DiscoveryQuery,
  taste: TasteProfile | null,
  limit = 24,
  opts: { deck?: number; exclude?: number[] } = {},
): Promise<{ results: ScoredMovie[]; poolSize: number }> {
  const weights = await getActiveWeights();
  const skip = new Set(opts.exclude ?? []);
  const pool = (await retrieveCandidates(q, opts.deck ?? 0)).filter((m) => !skip.has(m.tmdbId));
  const firstPass = rank(await profileAll(pool), q, { weights, taste, limit: Math.min(48, limit * 2) });

  // Stage 2: enrich the short list (cached per movie for a day).
  const enriched = await Promise.allSettled(firstPass.map((s) => getMovieBasics(s.movie.tmdbId)));
  const keywordMap = new Map<number, string[]>();
  const movies: MovieSummary[] = firstPass.map((s, i) => {
    const e = enriched[i];
    if (e.status !== "fulfilled") return s.movie;
    keywordMap.set(s.movie.tmdbId, e.value.keywords);
    return { ...s.movie, runtime: e.value.runtime, countries: e.value.countries };
  });

  // Runtime filters can only be verified after enrichment.
  const filtered = movies.filter(
    (m) => (!q.maxRuntime || !m.runtime || m.runtime <= q.maxRuntime) && (!q.minRuntime || !m.runtime || m.runtime >= q.minRuntime),
  );
  const results = rank(await profileAll(filtered, keywordMap), q, { weights, taste, limit });
  return { results, poolSize: pool.length };
}

/** Similar-by-mood: candidates sharing the movie's top moods, excluding itself. */
export async function moodNeighbours(seed: MovieSummary, profile: Candidate["profile"], limit = 12) {
  const top = Object.entries(profile.scores)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([m]) => m) as DiscoveryQuery["moods"];
  const q: DiscoveryQuery = {
    moods: top,
    languages: [],
    genres: [],
    minYear: null,
    maxYear: null,
    minRuntime: null,
    maxRuntime: null,
    minRating: null,
    region: null,
    availability: "any",
    sort: "recommended",
  };
  try {
    const pool = (await retrieveCandidates(q)).filter((m) => m.tmdbId !== seed.tmdbId);
    return rank(await profileAll(pool), q, { limit });
  } catch (e) {
    logError("recommendations", "moodNeighbours failed", e);
    return [];
  }
}

/**
 * Trending blend: TMDB day + week momentum plus Trakt's live "watching now"
 * signal (when TRAKT_CLIENT_ID is set). Trakt-only titles are hydrated from TMDB.
 */
export async function trendingBlend(): Promise<MovieSummary[]> {
  const [week, day, trakt] = await Promise.allSettled([getTrending("week"), getTrending("day"), getTraktTrending(40)]);
  const map = new Map<number, { m: MovieSummary; s: number }>();
  const add = (list: MovieSummary[], weight: number) =>
    list.forEach((m, i) => {
      const prev = map.get(m.tmdbId);
      const s = weight * (1 - i / list.length);
      map.set(m.tmdbId, { m: prev?.m ?? m, s: (prev?.s ?? 0) + s });
    });
  if (day.status === "fulfilled") add(day.value.results, 1);
  if (week.status === "fulfilled") add(week.value.results, 0.8);
  if (week.status === "rejected" && day.status === "rejected") throw week.reason;

  const traktList = trakt.status === "fulfilled" ? trakt.value : [];
  if (traktList.length) {
    const missing = traktList.filter((t) => !map.has(t.tmdbId)).slice(0, 10);
    const hydrated = await Promise.allSettled(missing.map((t) => getMovieBasics(t.tmdbId)));
    hydrated.forEach((h) => {
      if (h.status === "fulfilled") map.set(h.value.tmdbId, { m: h.value, s: 0 });
    });
    const maxW = Math.max(1, ...traktList.map((t) => t.watchers));
    for (const t of traktList) {
      const entry = map.get(t.tmdbId);
      if (entry) entry.s += 0.9 * (t.watchers / maxW);
    }
  }
  return [...map.values()].sort((a, b) => b.s - a.s).map((x) => x.m);
}

/** Movies people are watching on Trakt right now (empty when Trakt isn't configured). */
export async function traktWatchingNow(limit = 20): Promise<MovieSummary[]> {
  const list = (await getTraktTrending(limit)).slice(0, limit);
  const hydrated = await Promise.allSettled(list.map((t) => getMovieBasics(t.tmdbId)));
  return hydrated.filter((h): h is PromiseFulfilledResult<Awaited<ReturnType<typeof getMovieBasics>>> => h.status === "fulfilled").map((h) => h.value);
}
