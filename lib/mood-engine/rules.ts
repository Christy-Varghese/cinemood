import type { MoodProfile, MoodSlug } from "@/types/mood";

export const RULES_MODEL_VERSION = "rules-v1";

/**
 * Genre → mood contributions (TMDB genre ids). This is the master prompt's
 * rule-based fallback, extended with weights so a movie gets a *profile*,
 * not a single label.
 */
export const GENRE_MOODS: Record<number, Partial<Record<MoodSlug, number>>> = {
  10749: { romantic: 0.85, emotional: 0.45, feel_good: 0.3, hopeful: 0.3 }, // Romance
  35: { funny: 0.85, happy: 0.6, feel_good: 0.5, relaxing: 0.35 }, // Comedy
  18: { emotional: 0.65, thoughtful: 0.45, sad: 0.25 }, // Drama
  27: { scary: 0.9, intense: 0.6, dark: 0.55 }, // Horror
  53: { intense: 0.75, mysterious: 0.55, exciting: 0.5, dark: 0.3 }, // Thriller
  28: { exciting: 0.85, intense: 0.5, adventurous: 0.35 }, // Action
  12: { adventurous: 0.85, exciting: 0.65, happy: 0.25 }, // Adventure
  878: { thoughtful: 0.6, mind_bending: 0.6, adventurous: 0.35, exciting: 0.3 }, // Science Fiction
  16: { comforting: 0.6, happy: 0.55, adventurous: 0.3, feel_good: 0.4 }, // Animation
  10751: { comforting: 0.7, feel_good: 0.65, happy: 0.5, relaxing: 0.35 }, // Family
  10402: { happy: 0.6, emotional: 0.45, inspiring: 0.35 }, // Music
  36: { thoughtful: 0.65, inspiring: 0.3, emotional: 0.3 }, // History
  10752: { intense: 0.7, emotional: 0.6, dark: 0.45, sad: 0.35 }, // War
  9648: { mysterious: 0.85, mind_bending: 0.5, intense: 0.3 }, // Mystery
  80: { dark: 0.55, intense: 0.55, mysterious: 0.4 }, // Crime
  14: { adventurous: 0.6, mind_bending: 0.3, comforting: 0.25, happy: 0.25 }, // Fantasy
  99: { thoughtful: 0.75, inspiring: 0.35 }, // Documentary
  37: { adventurous: 0.5, nostalgic: 0.4, intense: 0.3 }, // Western
  10770: { relaxing: 0.4, comforting: 0.3 }, // TV Movie
};

/**
 * Keyword / overview lexicon. Matched against TMDB keywords and the overview,
 * so "time loop", "grief" or "underdog" shift the profile beyond genre.
 */
export const LEXICON: { pattern: RegExp; moods: Partial<Record<MoodSlug, number>> }[] = [
  { pattern: /\b(love|lovers?|romance|falls? in love|first love|wedding|soulmate|heartbreak)\b/i, moods: { romantic: 0.35, emotional: 0.1 } },
  { pattern: /\b(grief|griev|loss|dying|death of|terminal|funeral|widow|cancer)\b/i, moods: { sad: 0.35, emotional: 0.3 } },
  { pattern: /\b(friendship|family|father|mother|daughter|son|siblings?|reunion)\b/i, moods: { emotional: 0.15, comforting: 0.1 } },
  { pattern: /\b(time loop|time travel|parallel|alternate reality|dream|simulation|memory loss|amnesia|multiverse|identity)\b/i, moods: { mind_bending: 0.4, thoughtful: 0.15 } },
  { pattern: /\b(twist|nonlinear|unreliable|puzzle|psychological)\b/i, moods: { mind_bending: 0.3, mysterious: 0.2 } },
  { pattern: /\b(murder|detective|investigat|disappearance|missing|secret|conspiracy|clue)\b/i, moods: { mysterious: 0.35, intense: 0.1 } },
  { pattern: /\b(serial killer|revenge|vengeance|corrupt|violence|gangster|cartel|brutal)\b/i, moods: { dark: 0.35, intense: 0.25 } },
  { pattern: /\b(haunt|ghost|demon|possess|curse|evil|monster|zombie|slasher|exorcis)\b/i, moods: { scary: 0.4, dark: 0.15 } },
  { pattern: /\b(underdog|champion|against all odds|training|tournament|comeback|overcome|perseverance)\b/i, moods: { motivating: 0.4, inspiring: 0.3 } },
  { pattern: /\b(true story|based on a true|biography|biopic|real-life)\b/i, moods: { inspiring: 0.25, thoughtful: 0.2 } },
  { pattern: /\b(dream|hope|second chance|new beginning|redemption|healing)\b/i, moods: { hopeful: 0.3, inspiring: 0.1 } },
  { pattern: /\b(coming of age|childhood|teenage|high school|summer|growing up|nostalgi|1980s|1990s|retro)\b/i, moods: { nostalgic: 0.4, comforting: 0.1 } },
  { pattern: /\b(journey|quest|expedition|road trip|treasure|explore|voyage|island)\b/i, moods: { adventurous: 0.35 } },
  { pattern: /\b(heist|chase|race|escape|mission|explosive|fight|battle)\b/i, moods: { exciting: 0.3, intense: 0.1 } },
  { pattern: /\b(slice of life|everyday|quiet|gentle|countryside|village|cooking|food|tea|cafe)\b/i, moods: { relaxing: 0.35, comforting: 0.25 } },
  { pattern: /\b(hilarious|comedy|spoof|parody|mishap|chaos ensues|wacky|prank)\b/i, moods: { funny: 0.35, happy: 0.1 } },
  { pattern: /\b(philosoph|existential|society|class|human nature|morality|dystopia)\b/i, moods: { thoughtful: 0.35, dark: 0.1 } },
  { pattern: /\b(war|holocaust|genocide|survival|refugee)\b/i, moods: { intense: 0.2, emotional: 0.2, sad: 0.15 } },
  { pattern: /\b(feel-good|heartwarming|uplifting|charming|whimsical)\b/i, moods: { feel_good: 0.4, happy: 0.2 } },
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RuleInput {
  genreIds: number[];
  overview?: string | null;
  keywords?: string[];
  runtime?: number | null;
  voteAverage?: number;
}

/**
 * Deterministic, explainable mood profile.
 * Genres establish the base; the lexicon adds nuance; scores combine with
 * a probabilistic OR (1 - Π(1 - s)) so evidence accumulates without exceeding 1.
 */
export function ruleBasedProfile(input: RuleInput): MoodProfile {
  const acc: Partial<Record<MoodSlug, number>> = {};
  const add = (mood: MoodSlug, s: number) => {
    const prev = acc[mood] ?? 0;
    acc[mood] = 1 - (1 - prev) * (1 - clamp01(s));
  };

  for (const g of input.genreIds) {
    const moods = GENRE_MOODS[g];
    if (!moods) continue;
    for (const [mood, s] of Object.entries(moods)) add(mood as MoodSlug, s!);
  }

  const text = [input.overview ?? "", ...(input.keywords ?? [])].join(" \n ");
  let lexHits = 0;
  if (text.trim()) {
    for (const rule of LEXICON) {
      if (rule.pattern.test(text)) {
        lexHits++;
        for (const [mood, s] of Object.entries(rule.moods)) add(mood as MoodSlug, s!);
      }
    }
  }

  // Short films read lighter; long ones read heavier.
  if (input.runtime && input.runtime <= 95) {
    if (acc.funny || acc.happy) add("relaxing", 0.15);
  }
  // Very well-reviewed dramas tend to be the "stays with you" kind.
  if ((input.voteAverage ?? 0) >= 7.8 && acc.emotional) add("thoughtful", 0.15);

  const scores: Partial<Record<MoodSlug, number>> = {};
  for (const [mood, s] of Object.entries(acc)) {
    if (s! >= 0.05) scores[mood as MoodSlug] = round2(s!);
  }

  // Confidence grows with evidence: genres alone are coarse; keywords help.
  const evidence = input.genreIds.length * 0.12 + lexHits * 0.08 + ((input.keywords?.length ?? 0) > 0 ? 0.15 : 0);
  return {
    scores,
    confidence: round2(clamp01(0.35 + evidence)),
    source: "rules",
    modelVersion: RULES_MODEL_VERSION,
    calculatedAt: new Date().toISOString(),
  };
}

/** Inverse map used for candidate retrieval: which genres usually carry a mood. */
export function genresForMood(mood: MoodSlug, minWeight = 0.5): number[] {
  return Object.entries(GENRE_MOODS)
    .filter(([, moods]) => (moods[mood] ?? 0) >= minWeight)
    .sort((a, b) => (b[1][mood] ?? 0) - (a[1][mood] ?? 0))
    .map(([id]) => Number(id));
}

/** Top N moods of a profile, strongest first. */
export function topMoods(profile: MoodProfile, n = 3): { mood: MoodSlug; score: number }[] {
  return Object.entries(profile.scores)
    .map(([mood, score]) => ({ mood: mood as MoodSlug, score: score ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
