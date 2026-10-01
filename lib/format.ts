import { languageName } from "@/lib/reference";
import type { MovieSummary } from "@/types/movie";
import type { MovieLite } from "@/lib/library/store";
import type { MoodProfile } from "@/types/mood";
import { topMoods } from "@/lib/mood-engine/rules";

export const year = (d: string | null | undefined) => (d ? d.slice(0, 4) : "");

export function runtime(min: number | null | undefined) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export const rating = (v: number) => (v ? v.toFixed(1) : "–");

export const lang = (code: string) => (code ? languageName(code) : "");

/** SEO-friendly movie path: /movie/27205-inception */
export function moviePath(m: { tmdbId: number; title: string }) {
  const slug = m.title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `/movie/${m.tmdbId}${slug ? `-${slug}` : ""}`;
}

export function toLite(m: MovieSummary, profile?: MoodProfile): MovieLite {
  return {
    tmdbId: m.tmdbId,
    title: m.title,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    releaseDate: m.releaseDate,
    originalLanguage: m.originalLanguage,
    voteAverage: m.voteAverage,
    genreIds: m.genreIds,
    runtime: m.runtime ?? null,
    moods: profile ? topMoods(profile, 3).map((t) => t.mood) : [],
  };
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}
