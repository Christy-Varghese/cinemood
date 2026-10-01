import "server-only";
import { z } from "zod";
import { ollamaJson } from "@/lib/ai/ollama";
import { isAiConfigured } from "@/lib/env";
import { isMoodSlug, MOOD_SLUGS } from "@/lib/moods/taxonomy";
import { GENRES, LANGUAGES } from "@/lib/reference";
import { normalizeForCache, parseNaturalLanguage } from "./query";
import type { MoodSlug } from "@/types/mood";
import type { DiscoveryQuery } from "@/types/recommendation";

const AiQuerySchema = z.object({
  moods: z.array(z.string()).max(5).default([]),
  languages: z.array(z.string()).max(5).default([]),
  genres: z.array(z.string()).max(5).default([]),
  max_runtime: z.number().int().min(40).max(400).nullable().default(null),
  min_rating: z.number().min(0).max(10).nullable().default(null),
  year_range: z.tuple([z.number().int(), z.number().int()]).nullable().default(null),
});

const SYSTEM = `Convert a movie request into filters. Return strict JSON only:
{"moods":[],"languages":[],"genres":[],"max_runtime":null,"min_rating":null,"year_range":null}
moods: up to 3 of ${MOOD_SLUGS.join(", ")}
languages: ISO 639-1 codes from ${LANGUAGES.map((l) => `${l.code}=${l.name}`).join(", ")}
genres: names from ${GENRES.map((g) => g.name).join(", ")} — only if the user explicitly names a genre/format
max_runtime in minutes; year_range as [from,to]. Never suggest movie titles.`;

const cache = new Map<string, { at: number; q: DiscoveryQuery; source: "ai" | "rules" }>();

/**
 * AI interprets; the database/recommendation engine provides the movies.
 * Rules run first (free, instant); the local model refines when available.
 * Results are cached by normalized query to control cost.
 */
export async function interpretQuery(input: string, useAi = true): Promise<{ query: DiscoveryQuery; source: "ai" | "rules" }> {
  const key = normalizeForCache(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60 * 60_000) return { query: hit.q, source: hit.source };

  const rules = parseNaturalLanguage(input);
  if (!useAi || !isAiConfigured()) {
    cache.set(key, { at: Date.now(), q: rules, source: "rules" });
    return { query: rules, source: "rules" };
  }

  const raw = await ollamaJson(SYSTEM, input.slice(0, 300), { timeoutMs: 8000, retries: 0 });
  const parsed = raw ? AiQuerySchema.safeParse(raw) : null;
  if (!parsed?.success) {
    cache.set(key, { at: Date.now(), q: rules, source: "rules" });
    return { query: rules, source: "rules" };
  }

  const ai = parsed.data;
  const langs = new Set(LANGUAGES.map((l) => l.code));
  const merged: DiscoveryQuery = {
    ...rules,
    moods: [...new Set([...rules.moods, ...ai.moods.map((m) => m.toLowerCase().replace(/[-\s]/g, "_")).filter(isMoodSlug)])].slice(0, 3) as MoodSlug[],
    languages: [...new Set([...rules.languages, ...ai.languages.filter((l) => langs.has(l))])].slice(0, 3),
    genres: rules.genres.length
      ? rules.genres
      : ai.genres.map((n) => GENRES.find((g) => g.name.toLowerCase() === n.toLowerCase())?.id).filter((x): x is number => !!x).slice(0, 3),
    maxRuntime: rules.maxRuntime ?? ai.max_runtime,
    minRating: rules.minRating ?? ai.min_rating,
    minYear: rules.minYear ?? ai.year_range?.[0] ?? null,
    maxYear: rules.maxYear ?? ai.year_range?.[1] ?? null,
  };
  const structured = merged.moods.length + merged.languages.length + merged.genres.length;
  merged.text = structured ? null : input.trim().slice(0, 200);
  if (cache.size > 2000) cache.clear();
  cache.set(key, { at: Date.now(), q: merged, source: "ai" });
  return { query: merged, source: "ai" };
}
