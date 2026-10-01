import { z } from "zod";
import { isMoodSlug } from "@/lib/moods/taxonomy";
import type { TasteProfile } from "@/types/recommendation";

/**
 * Client-supplied taste summary (derived from the user's own saves/likes).
 * It is *input preferences*, not scores — still bounded and sanitized, and
 * the server computes every score itself.
 */
const TasteSchema = z.object({
  moods: z.record(z.string(), z.number()).default({}),
  languages: z.record(z.string(), z.number()).default({}),
  genres: z.record(z.string(), z.number()).default({}),
  negative: z.array(z.number().int().positive()).max(500).default([]),
  watched: z.array(z.number().int().positive()).max(2000).default([]),
});

const bound = (rec: Record<string, number>, keyOk: (k: string) => boolean) =>
  Object.fromEntries(
    Object.entries(rec)
      .filter(([k, v]) => keyOk(k) && Number.isFinite(v))
      .slice(0, 60)
      .map(([k, v]) => [k, Math.max(-20, Math.min(20, v))]),
  );

export function sanitizeTaste(input: unknown): TasteProfile | null {
  if (!input) return null;
  const parsed = TasteSchema.safeParse(input);
  if (!parsed.success) return null;
  const t = parsed.data;
  return {
    moods: bound(t.moods, isMoodSlug),
    languages: bound(t.languages, (k) => /^[a-z]{2}$/.test(k)),
    genres: bound(t.genres, (k) => /^\d{1,6}$/.test(k)),
    negative: t.negative,
    watched: t.watched,
  };
}
