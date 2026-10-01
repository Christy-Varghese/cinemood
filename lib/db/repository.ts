import "server-only";
import { supabaseAdmin } from "./supabase";
import { logError } from "@/lib/logger";
import { DEFAULT_WEIGHTS, validateWeights } from "@/lib/recommendations/engine";
import { MOOD_SEED } from "@/lib/moods/taxonomy";
import type { Mood, MoodProfile, MoodSlug } from "@/types/mood";
import type { RecommendationWeights } from "@/types/recommendation";

/**
 * Database reads with graceful fallbacks. When Supabase isn't configured
 * (or a query fails) CineMood keeps working on the seed taxonomy and
 * on-the-fly rule-based mood profiles.
 */

let moodCache: { at: number; moods: Mood[] } | null = null;

export async function getMoods(): Promise<Mood[]> {
  const sb = supabaseAdmin();
  if (!sb) return MOOD_SEED;
  if (moodCache && Date.now() - moodCache.at < 5 * 60_000) return moodCache.moods;
  const { data, error } = await sb
    .from("moods")
    .select("id, slug, name, icon, description, tagline, accent, is_active, featured, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data?.length) {
    if (error) logError("db", "getMoods failed", error);
    return MOOD_SEED;
  }
  const moods: Mood[] = data.map((m) => ({
    id: m.id,
    slug: m.slug as MoodSlug,
    name: m.name,
    icon: m.icon,
    description: m.description ?? "",
    tagline: m.tagline ?? "",
    accent: m.accent ?? "#F5B544",
    isActive: m.is_active,
    featured: m.featured,
    sortOrder: m.sort_order,
  }));
  moodCache = { at: Date.now(), moods };
  return moods;
}

/** Stored (AI / manual) profiles for a set of TMDB ids — these override on-the-fly rules. */
export async function getStoredProfiles(tmdbIds: number[]): Promise<Map<number, MoodProfile>> {
  const out = new Map<number, MoodProfile>();
  const sb = supabaseAdmin();
  if (!sb || !tmdbIds.length) return out;
  const { data, error } = await sb
    .from("movie_moods")
    .select("score, confidence, source, model_version, updated_at, moods!inner(slug), movies!inner(tmdb_id)")
    .in("movies.tmdb_id", tmdbIds.slice(0, 300));
  if (error) {
    logError("db", "getStoredProfiles failed", error);
    return out;
  }
  for (const row of (data ?? []) as unknown as {
    score: number;
    confidence: number;
    source: MoodProfile["source"];
    model_version: string;
    updated_at: string;
    moods: { slug: MoodSlug };
    movies: { tmdb_id: number };
  }[]) {
    const id = row.movies.tmdb_id;
    const p = out.get(id) ?? { scores: {}, confidence: 0, source: "database" as const, modelVersion: row.model_version, calculatedAt: row.updated_at };
    p.scores[row.moods.slug] = Number(row.score);
    p.confidence = Math.max(p.confidence, Number(row.confidence));
    out.set(id, p);
  }
  return out;
}

let weightCache: { at: number; w: RecommendationWeights } | null = null;

export async function getActiveWeights(): Promise<RecommendationWeights> {
  const sb = supabaseAdmin();
  if (!sb) return DEFAULT_WEIGHTS;
  if (weightCache && Date.now() - weightCache.at < 60_000) return weightCache.w;
  const { data, error } = await sb.from("recommendation_configs").select("weights").eq("is_active", true).order("version", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return DEFAULT_WEIGHTS;
  const w = { ...DEFAULT_WEIGHTS, ...(data.weights as Partial<RecommendationWeights>) };
  const valid = validateWeights(w).ok ? w : DEFAULT_WEIGHTS;
  weightCache = { at: Date.now(), w: valid };
  return valid;
}

export type FeatureFlag = "AI_SEARCH" | "PERSONALIZATION" | "STREAMING_AVAILABILITY" | "SURPRISE_ME" | "MOOD_ENGINE_V2";
const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  AI_SEARCH: true,
  PERSONALIZATION: true,
  STREAMING_AVAILABILITY: true,
  SURPRISE_ME: true,
  MOOD_ENGINE_V2: false,
};

export async function getFlags(): Promise<Record<FeatureFlag, boolean>> {
  const sb = supabaseAdmin();
  if (!sb) return FLAG_DEFAULTS;
  const { data } = await sb.from("feature_flags").select("key, enabled");
  const flags = { ...FLAG_DEFAULTS };
  for (const f of data ?? []) if (f.key in flags) flags[f.key as FeatureFlag] = !!f.enabled;
  return flags;
}
