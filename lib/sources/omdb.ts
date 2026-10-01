import "server-only";
import { z } from "zod";
import { env, isOmdbConfigured } from "@/lib/env";
import { logError } from "@/lib/logger";

/**
 * OMDb — IMDb, Rotten Tomatoes and Metacritic scores plus the awards line.
 * Free key: 1,000 requests/day. Data is CC BY-NC 4.0 (non-commercial) — attributed in the UI.
 * Cached for a day per IMDb id so a popular movie page costs one request per day.
 */
const OmdbSchema = z.object({
  Response: z.string(),
  imdbRating: z.string().optional(),
  imdbVotes: z.string().optional(),
  Metascore: z.string().optional(),
  Rated: z.string().optional(),
  Awards: z.string().optional(),
  BoxOffice: z.string().optional(),
  Ratings: z.array(z.object({ Source: z.string(), Value: z.string() })).optional(),
});

export interface ExternalRatings {
  imdb: { rating: number; votes: number } | null;
  rottenTomatoes: number | null; // 0–100 %
  metacritic: number | null; // 0–100
  certification: string | null; // e.g. "PG-13"
  awardsSummary: string | null; // e.g. "Won 4 Oscars. 309 wins & 271 nominations total"
  boxOffice: string | null;
}

const num = (s?: string) => {
  if (!s || s === "N/A") return null;
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const text = (s?: string) => (s && s !== "N/A" ? s : null);

export async function getOmdbRatings(imdbId: string | null): Promise<ExternalRatings | null> {
  if (!isOmdbConfigured() || !imdbId || !/^tt\d{5,10}$/.test(imdbId)) return null;
  try {
    const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(env.omdbKey)}&i=${imdbId}`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24, tags: ["omdb"] } });
    if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
    const parsed = OmdbSchema.safeParse(await res.json());
    if (!parsed.success || parsed.data.Response !== "True") return null;
    const d = parsed.data;
    const rt = d.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
    const imdbRating = num(d.imdbRating);
    return {
      imdb: imdbRating !== null ? { rating: imdbRating, votes: num(d.imdbVotes) ?? 0 } : null,
      rottenTomatoes: num(rt),
      metacritic: num(d.Metascore),
      certification: text(d.Rated),
      awardsSummary: text(d.Awards),
      boxOffice: text(d.BoxOffice),
    };
  } catch (e) {
    logError("tmdb", "OMDb lookup failed", e);
    return null;
  }
}
