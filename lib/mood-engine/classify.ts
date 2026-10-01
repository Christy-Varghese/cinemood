import "server-only";
import { z } from "zod";
import { ollamaJson } from "@/lib/ai/ollama";
import { env } from "@/lib/env";
import { MOOD_SLUGS } from "@/lib/moods/taxonomy";
import { ruleBasedProfile, type RuleInput } from "./rules";
import type { MoodProfile, MoodSlug } from "@/types/mood";

const AiMoodSchema = z.object({
  moods: z
    .array(
      z.object({
        mood: z.string(),
        score: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(20),
});

const SYSTEM = `You classify movies by the MOOD they create in a viewer.
Allowed moods: ${MOOD_SLUGS.join(", ")}.
Return strict JSON: {"moods":[{"mood":"<allowed mood>","score":0.0-1.0,"confidence":0.0-1.0}]}
Include 4-8 moods. Score is how strongly the movie delivers that mood. Use only the facts given; do not invent plot details.`;

/**
 * AI-first mood classification with validation, retry and rule-based fallback.
 * Mood generation can never break ingestion: any failure returns the rules profile.
 */
export async function classifyMovieMoods(
  input: RuleInput & { title: string; year?: string | null; language?: string },
): Promise<MoodProfile> {
  const fallback = ruleBasedProfile(input);
  const user = JSON.stringify({
    title: input.title,
    year: input.year ?? null,
    language: input.language ?? null,
    genres: input.genreIds,
    keywords: (input.keywords ?? []).slice(0, 25),
    overview: (input.overview ?? "").slice(0, 1200),
    runtime: input.runtime ?? null,
  });

  const raw = await ollamaJson(SYSTEM, user, { retries: 1 });
  if (!raw) return fallback;

  const parsed = AiMoodSchema.safeParse(raw);
  if (!parsed.success) return fallback;

  const scores: Partial<Record<MoodSlug, number>> = {};
  let confSum = 0;
  let n = 0;
  for (const m of parsed.data.moods) {
    const slug = m.mood.toLowerCase().replace(/[-\s]/g, "_");
    if (!(MOOD_SLUGS as string[]).includes(slug)) continue;
    scores[slug as MoodSlug] = Math.round(m.score * 100) / 100;
    confSum += m.confidence;
    n++;
  }
  if (n === 0) return fallback;

  // Blend: AI provides nuance, rules keep it grounded in metadata.
  for (const [mood, s] of Object.entries(fallback.scores)) {
    const k = mood as MoodSlug;
    if (scores[k] === undefined) scores[k] = Math.round(s! * 0.5 * 100) / 100;
  }

  return {
    scores,
    confidence: Math.round((confSum / n) * 100) / 100,
    source: "ai",
    modelVersion: `ollama:${env.ollamaModel}`,
    calculatedAt: new Date().toISOString(),
  };
}
