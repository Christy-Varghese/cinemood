import "server-only";
import { tmdb } from "./client";
import { env } from "@/lib/env";
import { ruleBasedProfile } from "@/lib/mood-engine/rules";
import type { MovieDetail, MovieSummary, Paged, Review, WatchAvailability, WatchProvider, Video } from "@/types/movie";

/* ───────────── Raw TMDB shapes (only the fields we use) ───────────── */

interface RawMovie {
  id: number;
  title?: string;
  original_title?: string;
  original_language?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  adult?: boolean;
  runtime?: number | null;
}
interface RawPage<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}
interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}
interface RawDetail extends RawMovie {
  tagline?: string | null;
  imdb_id?: string | null;
  status?: string | null;
  homepage?: string | null;
  spoken_languages?: { iso_639_1: string; english_name: string; name: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null; order: number }[];
    crew: { id: number; name: string; job: string; department: string; profile_path: string | null }[];
  };
  keywords?: { keywords?: { id: number; name: string }[] };
  reviews?: RawPage<RawReview>;
  videos?: { results: { key: string; name: string; site: string; type: string; official: boolean }[] };
  "watch/providers"?: {
    results: Record<string, { link?: string; flatrate?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[]; free?: RawProvider[]; ads?: RawProvider[] }>;
  };
  similar?: RawPage<RawMovie>;
  recommendations?: RawPage<RawMovie>;
}
interface RawReview {
  id: string;
  author: string;
  author_details?: { name?: string; username?: string; avatar_path?: string | null; rating?: number | null };
  content: string;
  created_at: string;
  url: string;
}

/* ───────────── Normalizers ───────────── */

export function normalizeMovie(r: RawMovie): MovieSummary {
  return {
    tmdbId: r.id,
    title: r.title ?? r.original_title ?? "Untitled",
    originalTitle: r.original_title ?? r.title ?? "",
    originalLanguage: r.original_language ?? "",
    overview: r.overview ?? "",
    posterPath: r.poster_path ?? null,
    backdropPath: r.backdrop_path ?? null,
    releaseDate: r.release_date || null,
    voteAverage: r.vote_average ?? 0,
    voteCount: r.vote_count ?? 0,
    popularity: r.popularity ?? 0,
    genreIds: r.genre_ids ?? r.genres?.map((g) => g.id) ?? [],
    runtime: r.runtime ?? null,
  };
}

const normalizePage = (p: RawPage<RawMovie>): Paged<MovieSummary> => ({
  page: p.page,
  totalPages: Math.min(p.total_pages, 500), // TMDB caps paging at 500
  totalResults: p.total_results,
  results: p.results.filter((m) => !m.adult).map(normalizeMovie),
});

function normalizeReview(r: RawReview): Review {
  const avatar = r.author_details?.avatar_path ?? null;
  return {
    id: r.id,
    author: r.author_details?.name || r.author,
    username: r.author_details?.username ?? null,
    // TMDB sometimes stores a full gravatar URL with a leading slash.
    avatarPath: avatar && avatar.startsWith("/http") ? avatar.slice(1) : avatar,
    rating: typeof r.author_details?.rating === "number" ? r.author_details.rating : null,
    content: r.content,
    createdAt: r.created_at,
    url: r.url,
  };
}

const prov = (list?: RawProvider[]): WatchProvider[] =>
  (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));

/* ───────────── Lists ───────────── */

export type ListKind = "popular" | "top_rated" | "now_playing" | "upcoming";

export async function getList(kind: ListKind, page = 1, region?: string) {
  const raw = await tmdb<RawPage<RawMovie>>(`/movie/${kind}`, { page, region });
  return normalizePage(raw);
}

export async function getTrending(window: "day" | "week" = "week", page = 1) {
  const raw = await tmdb<RawPage<RawMovie>>(`/trending/movie/${window}`, { page }, 60 * 60);
  return normalizePage(raw);
}

export interface DiscoverParams {
  page?: number;
  genres?: number[];
  genreMode?: "and" | "or";
  language?: string;
  originCountry?: string;
  minYear?: number | null;
  maxYear?: number | null;
  minRuntime?: number | null;
  maxRuntime?: number | null;
  minRating?: number | null;
  minVotes?: number;
  maxVotes?: number;
  sortBy?: "popularity.desc" | "vote_average.desc" | "primary_release_date.desc" | "vote_count.desc";
  region?: string;
  monetization?: ("flatrate" | "rent" | "buy" | "free" | "ads")[];
  releaseFrom?: string;
  releaseTo?: string;
  /** TMDB keyword ids, OR-ed. */
  keywords?: number[];
}

export async function discover(p: DiscoverParams) {
  const raw = await tmdb<RawPage<RawMovie>>("/discover/movie", {
    page: p.page ?? 1,
    include_adult: false,
    include_video: false,
    with_genres: p.genres?.length ? p.genres.join(p.genreMode === "and" ? "," : "|") : undefined,
    with_original_language: p.language,
    with_keywords: p.keywords?.length ? p.keywords.join("|") : undefined,
    with_origin_country: p.originCountry,
    "primary_release_date.gte": p.releaseFrom ?? (p.minYear ? `${p.minYear}-01-01` : undefined),
    "primary_release_date.lte": p.releaseTo ?? (p.maxYear ? `${p.maxYear}-12-31` : undefined),
    "with_runtime.gte": p.minRuntime ?? undefined,
    "with_runtime.lte": p.maxRuntime ?? undefined,
    "vote_average.gte": p.minRating ?? undefined,
    "vote_count.gte": p.minVotes ?? 50,
    "vote_count.lte": p.maxVotes,
    sort_by: p.sortBy ?? "popularity.desc",
    watch_region: p.monetization?.length ? (p.region ?? env.defaultRegion) : undefined,
    with_watch_monetization_types: p.monetization?.length ? p.monetization.join("|") : undefined,
  });
  return normalizePage(raw);
}

export async function searchMovies(query: string, page = 1) {
  const raw = await tmdb<RawPage<RawMovie>>("/search/movie", { query, page, include_adult: false }, 60 * 30);
  return normalizePage(raw);
}

/** Person search → their best-known movies (actor / director search). */
export async function searchPeopleMovies(query: string) {
  const raw = await tmdb<RawPage<{ id: number; name: string; known_for_department: string; known_for?: (RawMovie & { media_type?: string })[] }>>(
    "/search/person",
    { query, include_adult: false },
    60 * 30,
  );
  const person = raw.results[0];
  if (!person) return { person: null, movies: [] as MovieSummary[] };
  const credits = await tmdb<{ cast: RawMovie[]; crew: (RawMovie & { job: string })[] }>(`/person/${person.id}/movie_credits`);
  const pool = person.known_for_department === "Directing" ? credits.crew.filter((c) => c.job === "Director") : credits.cast;
  const seen = new Set<number>();
  const movies = pool
    .filter((m) => !m.adult && (m.vote_count ?? 0) > 20 && !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 40)
    .map(normalizeMovie);
  return { person: { id: person.id, name: person.name, department: person.known_for_department }, movies };
}

/** Keyword search (e.g. "time loop") → discover with that keyword. */
/** Resolve keyword names ("christmas") to TMDB keyword ids — exact name match preferred. */
export async function keywordIds(names: string[]) {
  const ids = await Promise.all(
    names.map(async (name) => {
      const kw = await tmdb<RawPage<{ id: number; name: string }>>("/search/keyword", { query: name }, 60 * 60 * 24 * 7);
      return (kw.results.find((k) => k.name.toLowerCase() === name.toLowerCase()) ?? kw.results[0])?.id;
    }),
  );
  return ids.filter((x): x is number => typeof x === "number");
}

export async function searchByKeyword(query: string) {
  const kw = await tmdb<RawPage<{ id: number; name: string }>>("/search/keyword", { query }, 60 * 60 * 24);
  const exact = kw.results.find((k) => k.name.toLowerCase() === query.toLowerCase()) ?? kw.results[0];
  if (!exact) return { keyword: null, movies: [] as MovieSummary[] };
  const raw = await tmdb<RawPage<RawMovie>>("/discover/movie", { with_keywords: exact.id, sort_by: "popularity.desc", "vote_count.gte": 30, include_adult: false });
  return { keyword: exact.name, movies: normalizePage(raw).results };
}

/* ───────────── Release calendar ───────────── */

export interface Release {
  movie: MovieSummary;
  /** Release date in the requested region (falls back to the worldwide premiere). */
  date: string;
  kind: "Theatrical" | "Limited" | "Digital" | "Premiere";
}

const RELEASE_KIND: Record<number, Release["kind"]> = { 1: "Premiere", 2: "Limited", 3: "Theatrical", 4: "Digital" };

/**
 * Films with a theatrical or digital release in `region` between two dates, most-anticipated first.
 * Each is checked against TMDB's per-country release dates so the date shown is the local one.
 */
export async function getReleases(from: string, to: string, region = env.defaultRegion, limit = 48): Promise<Release[]> {
  const params = (page: number) => ({
    page,
    region,
    "release_date.gte": from,
    "release_date.lte": to,
    with_release_type: "2|3|4",
    sort_by: "popularity.desc",
    include_adult: false,
  });
  const pages = await Promise.allSettled([1, 2, 3].map((p) => tmdb<RawPage<RawMovie>>("/discover/movie", params(p), 60 * 60 * 6)));
  if (pages.every((p) => p.status === "rejected")) throw (pages[0] as PromiseRejectedResult).reason;
  const seen = new Set<number>();
  const movies = pages
    .flatMap((p) => (p.status === "fulfilled" ? p.value.results : []))
    .filter((m) => !m.adult && (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .slice(0, limit);

  type RawDates = { results: { iso_3166_1: string; release_dates: { release_date: string; type: number }[] }[] };
  const detailed = await Promise.allSettled(movies.map((m) => tmdb<RawDates>(`/movie/${m.id}/release_dates`, {}, 60 * 60 * 24)));
  const out: Release[] = [];
  movies.forEach((m, i) => {
    const d = detailed[i];
    const local = d.status === "fulfilled" ? d.value.results.find((r) => r.iso_3166_1 === region)?.release_dates ?? [] : [];
    const inRange = local
      .filter((r) => r.type >= 2 && r.type <= 4)
      .map((r) => ({ date: r.release_date.slice(0, 10), type: r.type }))
      .filter((r) => r.date >= from && r.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || b.type - a.type)[0];
    const date = inRange?.date ?? (m.release_date && m.release_date >= from && m.release_date <= to ? m.release_date : null);
    if (!date) return;
    out.push({ movie: normalizeMovie(m), date, kind: RELEASE_KIND[inRange?.type ?? 3] ?? "Theatrical" });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || b.movie.popularity - a.movie.popularity);
}

/* ───────────── Details & reviews ───────────── */

export async function getMovieDetail(id: number, region = env.defaultRegion): Promise<MovieDetail> {
  const r = await tmdb<RawDetail>(`/movie/${id}`, {
    append_to_response: "credits,keywords,reviews,videos,watch/providers,similar,recommendations",
  });
  const base = normalizeMovie(r);
  const keywords = r.keywords?.keywords?.map((k) => k.name) ?? [];
  const crew = r.credits?.crew ?? [];
  const toCrew = (c: (typeof crew)[number]) => ({ id: c.id, name: c.name, job: c.job, department: c.department, profilePath: c.profile_path });

  const wp = r["watch/providers"]?.results?.[region];
  const availability: WatchAvailability | null = wp
    ? { region, link: wp.link ?? null, subscription: prov(wp.flatrate), free: prov(wp.free), ads: prov(wp.ads), rent: prov(wp.rent), buy: prov(wp.buy) }
    : null;

  const vids = r.videos?.results ?? [];
  const trailer: Video | null =
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    null;

  // Prefer TMDB "recommendations" (behavioural), fall back to "similar" (metadata).
  const recs = (r.recommendations?.results?.length ? r.recommendations.results : r.similar?.results ?? []).filter((m) => !m.adult);

  return {
    ...base,
    tagline: r.tagline || null,
    runtime: r.runtime ?? null,
    status: r.status ?? null,
    homepage: r.homepage || null,
    imdbId: r.imdb_id || null,
    genres: r.genres ?? [],
    spokenLanguages: (r.spoken_languages ?? []).map((l) => ({ code: l.iso_639_1, name: l.english_name || l.name })),
    countries: (r.production_countries ?? []).map((c) => c.iso_3166_1),
    countryNames: (r.production_countries ?? []).map((c) => ({ code: c.iso_3166_1, name: c.name })),
    keywords,
    cast: (r.credits?.cast ?? []).slice(0, 18).map((c) => ({ id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order })),
    directors: crew.filter((c) => c.job === "Director").map(toCrew),
    writers: crew.filter((c) => c.job === "Screenplay" || c.job === "Writer").slice(0, 4).map(toCrew),
    reviews: (r.reviews?.results ?? []).map(normalizeReview),
    reviewTotal: r.reviews?.total_results ?? 0,
    trailer,
    availability,
    similar: recs.slice(0, 18).map(normalizeMovie),
    moodProfile: ruleBasedProfile({ genreIds: base.genreIds, overview: base.overview, keywords, runtime: r.runtime, voteAverage: base.voteAverage }),
  };
}

export async function getReviews(id: number, page = 1) {
  const raw = await tmdb<RawPage<RawReview>>(`/movie/${id}/reviews`, { page }, 60 * 60 * 6);
  return { page: raw.page, totalPages: raw.total_pages, totalResults: raw.total_results, results: raw.results.map(normalizeReview) };
}

/** Light details (runtime + countries) used to enrich a short list of candidates. */
export async function getMovieBasics(id: number) {
  const r = await tmdb<RawDetail>(`/movie/${id}`, { append_to_response: "keywords" }, 60 * 60 * 24);
  return {
    ...normalizeMovie(r),
    runtime: r.runtime ?? null,
    countries: (r.production_countries ?? []).map((c) => c.iso_3166_1),
    keywords: r.keywords?.keywords?.map((k) => k.name) ?? [],
  };
}

export async function getGenres() {
  const raw = await tmdb<{ genres: { id: number; name: string }[] }>("/genre/movie/list", {}, 60 * 60 * 24 * 7);
  return raw.genres;
}
