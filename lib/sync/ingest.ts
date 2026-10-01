import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase";
import { tmdb } from "@/lib/tmdb/client";
import { discover, getList, getTrending } from "@/lib/tmdb/movies";
import { classifyMovieMoods } from "@/lib/mood-engine/classify";
import { logError, logInfo } from "@/lib/logger";
import type { MovieSummary } from "@/types/movie";

export type SyncKind = "popular" | "top_rated" | "now_playing" | "upcoming" | "trending" | "language" | "region";

interface RawFull {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  status: string;
  homepage: string | null;
  genres: { id: number; name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  keywords?: { keywords: { id: number; name: string }[] };
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null; order: number }[];
    crew: { id: number; name: string; job: string; department: string; profile_path: string | null }[];
  };
}

/**
 * TMDB → fetch → validate → normalize → upsert movie / genres / languages /
 * countries / people / cast / crew → generate mood profile (only if missing).
 * `tmdb_id` is the idempotency key, so re-runs never duplicate.
 */
export async function ingestMovie(tmdbId: number, opts: { regenerateMoods?: boolean } = {}) {
  const sb = supabaseAdmin();
  if (!sb) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for ingestion");

  const r = await tmdb<RawFull>(`/movie/${tmdbId}`, { append_to_response: "credits,keywords" }, 0);
  if (!r?.id || r.adult) return { skipped: true };

  const now = new Date().toISOString();
  const { data: movie, error } = await sb
    .from("movies")
    .upsert(
      {
        tmdb_id: r.id,
        title: r.title,
        original_title: r.original_title,
        original_language: r.original_language,
        overview: r.overview,
        poster_path: r.poster_path,
        backdrop_path: r.backdrop_path,
        release_date: r.release_date || null,
        runtime: r.runtime,
        vote_average: r.vote_average,
        vote_count: r.vote_count,
        popularity: r.popularity,
        adult: r.adult,
        status: r.status,
        homepage: r.homepage || null,
        keywords: r.keywords?.keywords?.map((k) => k.name) ?? [],
        updated_at: now,
        last_synced_at: now,
      },
      { onConflict: "tmdb_id" },
    )
    .select("id")
    .single();
  if (error || !movie) throw error ?? new Error("movie upsert failed");
  const movieId = movie.id as string;

  // Genres
  if (r.genres?.length) {
    const { data: g } = await sb
      .from("genres")
      .upsert(r.genres.map((x) => ({ tmdb_id: x.id, name: x.name, slug: x.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") })), { onConflict: "tmdb_id" })
      .select("id");
    await sb.from("movie_genres").upsert((g ?? []).map((row) => ({ movie_id: movieId, genre_id: row.id })), { onConflict: "movie_id,genre_id" });
  }
  // Spoken languages — kept separate from original_language and production countries.
  if (r.spoken_languages?.length) {
    const { data: l } = await sb
      .from("languages")
      .upsert(r.spoken_languages.map((x) => ({ code: x.iso_639_1, name: x.english_name || x.name, native_name: x.name })), { onConflict: "code", ignoreDuplicates: false })
      .select("id");
    await sb.from("movie_languages").upsert((l ?? []).map((row) => ({ movie_id: movieId, language_id: row.id })), { onConflict: "movie_id,language_id" });
  }
  if (r.production_countries?.length) {
    const { data: c } = await sb
      .from("countries")
      .upsert(r.production_countries.map((x) => ({ iso_code: x.iso_3166_1, name: x.name })), { onConflict: "iso_code" })
      .select("id");
    await sb.from("movie_countries").upsert((c ?? []).map((row) => ({ movie_id: movieId, country_id: row.id })), { onConflict: "movie_id,country_id" });
  }
  // People, cast, crew (top-billed cast + key crew only)
  const cast = (r.credits?.cast ?? []).slice(0, 15);
  const crew = (r.credits?.crew ?? []).filter((c) => ["Director", "Screenplay", "Writer", "Original Music Composer", "Director of Photography"].includes(c.job));
  const people = [...cast, ...crew];
  if (people.length) {
    const unique = [...new Map(people.map((p) => [p.id, { tmdb_id: p.id, name: p.name, profile_path: p.profile_path }])).values()];
    const { data: ppl } = await sb.from("people").upsert(unique, { onConflict: "tmdb_id" }).select("id, tmdb_id");
    const idOf = new Map((ppl ?? []).map((p) => [p.tmdb_id as number, p.id as string]));
    await sb.from("movie_cast").delete().eq("movie_id", movieId);
    await sb.from("movie_crew").delete().eq("movie_id", movieId);
    await sb.from("movie_cast").insert(cast.map((c) => ({ movie_id: movieId, person_id: idOf.get(c.id), character_name: c.character, cast_order: c.order })).filter((x) => x.person_id));
    await sb.from("movie_crew").insert(crew.map((c) => ({ movie_id: movieId, person_id: idOf.get(c.id), department: c.department, job: c.job })).filter((x) => x.person_id));
  }

  // Mood profile — only when missing (AI cost control), unless explicitly regenerating.
  const { count } = await sb.from("movie_moods").select("mood_id", { count: "exact", head: true }).eq("movie_id", movieId);
  if (!count || opts.regenerateMoods) await generateMoodProfile(movieId, r);
  return { skipped: false, movieId };
}

export async function generateMoodProfile(movieId: string, r: Pick<RawFull, "title" | "release_date" | "original_language" | "genres" | "overview" | "runtime" | "vote_average" | "keywords">) {
  const sb = supabaseAdmin();
  if (!sb) return;
  try {
    const profile = await classifyMovieMoods({
      title: r.title,
      year: r.release_date?.slice(0, 4),
      language: r.original_language,
      genreIds: r.genres.map((g) => g.id),
      overview: r.overview,
      keywords: r.keywords?.keywords?.map((k) => k.name),
      runtime: r.runtime,
      voteAverage: r.vote_average,
    });
    const { data: moods } = await sb.from("moods").select("id, slug");
    const idOf = new Map((moods ?? []).map((m) => [m.slug as string, m.id as string]));
    const rows = Object.entries(profile.scores)
      .filter(([slug]) => idOf.has(slug))
      .map(([slug, score]) => ({
        movie_id: movieId,
        mood_id: idOf.get(slug),
        score,
        confidence: profile.confidence,
        source: profile.source,
        model_version: profile.modelVersion,
        updated_at: profile.calculatedAt,
      }));
    // Manual admin adjustments are never overwritten by automatic runs.
    const { data: manual } = await sb.from("movie_moods").select("mood_id").eq("movie_id", movieId).eq("source", "manual");
    const locked = new Set((manual ?? []).map((m) => m.mood_id));
    const toWrite = rows.filter((row) => !locked.has(row.mood_id));
    if (toWrite.length) await sb.from("movie_moods").upsert(toWrite, { onConflict: "movie_id,mood_id" });
  } catch (e) {
    // Never break ingestion because mood generation failed.
    logError("ai", `mood generation failed for ${movieId}`, e);
  }
}

/** Batch sync job with status tracking in `jobs`. */
export async function runSync(kind: SyncKind, opts: { pages?: number; language?: string; region?: string } = {}) {
  const sb = supabaseAdmin();
  if (!sb) throw new Error("Supabase not configured");
  const { data: job } = await sb.from("jobs").insert({ type: "movie_sync", status: "running", payload: { kind, ...opts }, started_at: new Date().toISOString() }).select("id").single();
  const pages = Math.min(opts.pages ?? 1, 10);
  let ok = 0;
  let failed = 0;
  try {
    for (let page = 1; page <= pages; page++) {
      let list: MovieSummary[] = [];
      if (kind === "trending") list = (await getTrending("week", page)).results;
      else if (kind === "language" && opts.language) list = (await discover({ language: opts.language, page, minVotes: 20 })).results;
      else if (kind === "region" && opts.region) list = (await getList("now_playing", page, opts.region)).results;
      else if (kind !== "language" && kind !== "region") list = (await getList(kind, page)).results;
      for (const m of list) {
        try {
          await ingestMovie(m.tmdbId);
          ok++;
        } catch (e) {
          failed++;
          logError("tmdb", `ingest failed ${m.tmdbId}`, e);
        }
      }
    }
    await sb.from("jobs").update({ status: "completed", finished_at: new Date().toISOString(), result: { ok, failed } }).eq("id", job?.id);
    logInfo("admin", "sync completed", { kind, ok, failed });
    return { ok, failed, jobId: job?.id };
  } catch (e) {
    await sb.from("jobs").update({ status: "failed", finished_at: new Date().toISOString(), result: { ok, failed, error: String(e) } }).eq("id", job?.id);
    throw e;
  }
}
