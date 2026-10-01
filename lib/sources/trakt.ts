import "server-only";
import { z } from "zod";
import { env, isTraktConfigured } from "@/lib/env";
import { logError } from "@/lib/logger";

/**
 * Trakt — live community signals: what people are watching right now and
 * Trakt's own audience rating. Needs only a free app Client ID (no user login).
 */
const BASE = "https://api.trakt.tv";

async function trakt<T>(path: string, schema: z.ZodType<T>, revalidate: number): Promise<T | null> {
  if (!isTraktConfigured()) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": env.traktClientId },
      next: { revalidate, tags: ["trakt"] },
    });
    if (!res.ok) throw new Error(`Trakt HTTP ${res.status} for ${path}`);
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch (e) {
    logError("tmdb", "Trakt request failed", e);
    return null;
  }
}

const Ids = z.object({ trakt: z.number(), slug: z.string().optional(), imdb: z.string().nullable().optional(), tmdb: z.number().nullable().optional() });
const TrendingSchema = z.array(z.object({ watchers: z.number(), movie: z.object({ title: z.string(), year: z.number().nullable().optional(), ids: Ids }) }));
const RatingSchema = z.object({ rating: z.number(), votes: z.number() });

export interface TraktTrend {
  tmdbId: number;
  watchers: number;
  slug: string | null;
}

/** Movies being watched on Trakt right now, mapped to TMDB ids. */
export async function getTraktTrending(limit = 40): Promise<TraktTrend[]> {
  const data = await trakt(`/movies/trending?limit=${limit}`, TrendingSchema, 60 * 30);
  return (data ?? [])
    .filter((x) => x.movie.ids.tmdb)
    .map((x) => ({ tmdbId: x.movie.ids.tmdb!, watchers: x.watchers, slug: x.movie.ids.slug ?? null }));
}

/** Trakt audience rating (0–10) for a movie, looked up by IMDb id. */
export async function getTraktRating(imdbId: string | null): Promise<{ rating: number; votes: number; url: string } | null> {
  if (!imdbId || !/^tt\d{5,10}$/.test(imdbId)) return null;
  const data = await trakt(`/movies/${imdbId}/ratings`, RatingSchema, 60 * 60 * 12);
  if (!data || !data.votes) return null;
  return { rating: Math.round(data.rating * 10) / 10, votes: data.votes, url: `https://trakt.tv/movies/${imdbId}` };
}
