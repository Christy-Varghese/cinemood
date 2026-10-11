import "server-only";
import { unstable_cache } from "next/cache";
import { discover, getList, getTrending, keywordIds } from "@/lib/tmdb/movies";
import { env } from "@/lib/env";
import { activeSeasons, nextSeason, type Season } from "./seasons";
import { genrePulse } from "./genre-pulse";
import type { MovieSummary } from "@/types/movie";

/** Today's seasons for the site's region. Evaluated on every revalidation, so it rolls over by itself. */
export const seasonsNow = () => activeSeasons(new Date(), env.defaultRegion);
export const seasonNext = () => nextSeason(new Date(), env.defaultRegion);

async function fetchSeasonMovies(q: Season["query"]): Promise<MovieSummary[]> {
  const keywords = q.keywords?.length ? await keywordIds(q.keywords) : undefined;
  if (q.keywords?.length && !keywords?.length) return [];
  const releaseFrom = q.recentYears ? `${new Date().getUTCFullYear() - q.recentYears}-01-01` : undefined;
  const base = { genres: q.genres, genreMode: "or" as const, keywords, language: q.language, minVotes: q.minVotes, minRating: q.minRating, sortBy: q.sortBy, releaseFrom };
  const pages = await Promise.allSettled([discover({ ...base, page: 1 }), discover({ ...base, page: 2 })]);
  if (pages.every((p) => p.status === "rejected")) throw (pages[0] as PromiseRejectedResult).reason;
  const seen = new Set<number>();
  const out: MovieSummary[] = [];
  for (const p of pages) if (p.status === "fulfilled") for (const m of p.value.results) if (m.posterPath && !seen.has(m.tmdbId)) (seen.add(m.tmdbId), out.push(m));
  return out;
}

/** Films for a season — cached 6h per season. */
export const getSeasonMovies = (s: Season) => unstable_cache(() => fetchSeasonMovies(s.query), ["season-movies-v1", s.slug], { revalidate: 60 * 60 * 6, tags: ["season"] })();

/** Genres trending above their normal share this week (TMDB trending vs the all-time popular catalogue). */
async function computePulse() {
  const [trending, baseline] = await Promise.all([
    Promise.allSettled([getTrending("day", 1), getTrending("week", 1), getTrending("week", 2), getTrending("week", 3)]),
    Promise.allSettled([1, 2, 3, 4, 5].map((page) => discover({ sortBy: "vote_count.desc", minVotes: 1000, page }))),
  ]);
  const t = trending.flatMap((p) => (p.status === "fulfilled" ? p.value.results : []));
  const b = baseline.flatMap((p) => (p.status === "fulfilled" ? p.value.results : []));
  if (!t.length) {
    const failed = trending.find((p) => p.status === "rejected") as PromiseRejectedResult | undefined;
    throw failed?.reason ?? new Error("No trending data");
  }
  // De-duplicate (day and week lists overlap) keeping first (highest) position.
  const seen = new Set<number>();
  const uniq = t.filter((m) => (seen.has(m.tmdbId) ? false : (seen.add(m.tmdbId), true)));
  return genrePulse(uniq, b.length ? b : (await getList("popular")).results);
}
export const getGenrePulse = unstable_cache(computePulse, ["genre-pulse-v1"], { revalidate: 60 * 60 * 3, tags: ["pulse"] });
