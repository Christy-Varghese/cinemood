import { topMoods } from "@/lib/mood-engine/rules";
import { genreName, languageName } from "@/lib/reference";
import type { MoodProfile, MoodSlug } from "@/types/mood";
import type { MovieSummary } from "@/types/movie";
import type { DiscoveryQuery, RecommendationWeights, ResultLabel, ScoredMovie, TasteProfile } from "@/types/recommendation";

import { DEFAULT_WEIGHTS } from "./weights";
export { DEFAULT_WEIGHTS };

export function validateWeights(w: RecommendationWeights): { ok: boolean; total: number } {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return { ok: Math.abs(total - 1) < 0.001 && Object.values(w).every((v) => v >= 0), total };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Mood match: blends the average with the weakest selected mood, so a movie
 * must carry *all* requested moods to rank highly (Romantic + Emotional ≠ just Romance).
 */
export function moodMatch(profile: MoodProfile, moods: MoodSlug[]): number {
  if (!moods.length) return 0.5;
  const s = moods.map((m) => profile.scores[m] ?? 0);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const min = Math.min(...s);
  return clamp01(0.6 * mean + 0.4 * min);
}

/** Bayesian-shrunk rating so a 9.0 with 12 votes doesn't beat an 8.4 with 20k. */
export function ratingQuality(m: MovieSummary): number {
  const C = 6.4;
  const k = 250;
  const v = m.voteCount;
  const adj = (v * m.voteAverage + k * C) / (v + k);
  return clamp01((adj - 5) / 3.5);
}

export function freshness(m: MovieSummary, now = new Date()): number {
  if (!m.releaseDate) return 0.3;
  const years = (now.getTime() - new Date(m.releaseDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return 0.6; // upcoming
  return clamp01(Math.pow(0.5, years / 8));
}

function normalizedMap(map: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.values(map));
  if (max <= 0) return {};
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Math.max(0, v) / max]));
}

export function preferenceMatch(m: MovieSummary, profile: MoodProfile, taste?: TasteProfile | null): number {
  if (!taste) return 0.5;
  const moodPref = normalizedMap(taste.moods as Record<string, number>);
  const langPref = normalizedMap(taste.languages);
  const genrePref = normalizedMap(taste.genres);
  const hasSignal = Object.keys(moodPref).length + Object.keys(langPref).length + Object.keys(genrePref).length > 0;
  if (!hasSignal) return 0.5;

  const top = topMoods(profile, 4);
  const moodScore = top.length ? top.reduce((a, t) => a + (moodPref[t.mood] ?? 0) * t.score, 0) / top.length : 0;
  const langScore = langPref[m.originalLanguage] ?? 0;
  const genreScore = m.genreIds.length ? Math.max(0, ...m.genreIds.map((g) => genrePref[String(g)] ?? 0)) : 0;
  return clamp01(0.45 * moodScore * 1.6 + 0.3 * langScore + 0.25 * genreScore);
}

const MOOD_WORDS: Partial<Record<MoodSlug, string>> = { mind_bending: "mind-bending", feel_good: "feel-good" };
const moodWord = (m: MoodSlug) => MOOD_WORDS[m] ?? m;

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Short explanation built ONLY from metadata and scores — never invented plot. */
export function explain(m: MovieSummary, profile: MoodProfile, moods: MoodSlug[], taste?: TasteProfile | null): string {
  const parts: string[] = [];
  if (moods.length) {
    const strong = moods.filter((md) => (profile.scores[md] ?? 0) >= 0.6);
    if (strong.length === moods.length) {
      parts.push(moods.length > 1 ? `Scores strongly for ${listJoin(moods.map(moodWord))}.` : `A strong ${moodWord(moods[0])} pick.`);
    } else if (strong.length) {
      parts.push(`Strong on ${listJoin(strong.map(moodWord))}; lighter on ${listJoin(moods.filter((x) => !strong.includes(x)).map(moodWord))}.`);
    } else {
      parts.push(`A gentler take on ${listJoin(moods.map(moodWord))}.`);
    }
  } else {
    const t = topMoods(profile, 2).map((x) => moodWord(x.mood));
    if (t.length) parts.push(`Mostly ${listJoin(t)}.`);
  }
  const genres = m.genreIds.slice(0, 2).map(genreName).filter((g) => g !== "Other");
  const lang = m.originalLanguage ? languageName(m.originalLanguage) : null;
  const year = m.releaseDate?.slice(0, 4);
  const desc = [lang, genres.length ? genres.join(" / ").toLowerCase() : "film"].filter(Boolean).join(" ");
  parts.push(`${desc.charAt(0).toUpperCase()}${desc.slice(1)}${year ? ` from ${year}` : ""}${m.runtime ? `, ${m.runtime} min` : ""}.`);
  if (taste && (taste.languages[m.originalLanguage] ?? 0) > 1.5) parts.push(`You often save ${lang} films.`);
  return parts.join(" ");
}

export interface Candidate {
  movie: MovieSummary;
  profile: MoodProfile;
}

export interface RankOptions {
  weights?: RecommendationWeights;
  taste?: TasteProfile | null;
  limit?: number;
  now?: Date;
}

/** Score every candidate on the weighted formula (diversity applied during re-rank). */
export function scoreCandidates(cands: Candidate[], q: DiscoveryQuery, opts: RankOptions = {}): ScoredMovie[] {
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const taste = opts.taste ?? null;
  const maxPop = Math.max(1, ...cands.map((c) => c.movie.popularity));
  const watched = new Set(taste?.watched ?? []);
  const negative = new Set(taste?.negative ?? []);

  return cands
    .filter((c) => !watched.has(c.movie.tmdbId))
    .map(({ movie, profile }) => {
      const mood = moodMatch(profile, q.moods);
      const language = q.languages.length
        ? q.languages.includes(movie.originalLanguage)
          ? 1
          : 0
        : 0.5;
      const genre = q.genres.length ? q.genres.filter((g) => movie.genreIds.includes(g)).length / q.genres.length : 0.5;
      const preference = preferenceMatch(movie, profile, taste);
      const rating = ratingQuality(movie);
      const popularity = clamp01(Math.log1p(movie.popularity) / Math.log1p(maxPop));
      const fresh = freshness(movie, opts.now);
      const breakdown = { mood, language, genre, preference, rating, popularity, freshness: fresh, diversity: 0 };
      let score =
        w.mood * mood + w.language * language + w.genre * genre + w.preference * preference + w.rating * rating + w.popularity * popularity + w.freshness * fresh;
      if (negative.has(movie.tmdbId)) score *= 0.5;

      const labels: ResultLabel[] = [];
      if (q.moods.length && mood >= 0.7) labels.push("Great mood match");
      if (taste && preference >= 0.65) labels.push("Matches your taste");
      if (rating >= 0.8 && movie.voteCount > 500) labels.push("Highly rated");
      if (popularity >= 0.85) labels.push("Popular right now");
      if (fresh >= 0.85 && movie.releaseDate) labels.push("Fresh release");

      return { movie, profile, score, moodMatch: mood, breakdown, labels, explanation: "" };
    });
}

/**
 * Greedy diversity re-rank (MMR-style). Each pick is the candidate with the best
 * score + diversity bonus, where the bonus shrinks as its language and lead genre
 * repeat among picks already made. Keeps relevance while surfacing world cinema.
 */
export function diversify(scored: ScoredMovie[], q: DiscoveryQuery, w: RecommendationWeights, limit: number): ScoredMovie[] {
  const pool = [...scored].sort((a, b) => b.score - a.score);
  const picked: ScoredMovie[] = [];
  const langCount = new Map<string, number>();
  const genreCount = new Map<number, number>();
  // When the user fixed a language, only genre variety matters.
  const langMatters = q.languages.length !== 1;

  while (picked.length < limit && pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < Math.min(pool.length, 60); i++) {
      const c = pool[i];
      const lc = langCount.get(c.movie.originalLanguage) ?? 0;
      const gc = genreCount.get(c.movie.genreIds[0] ?? -1) ?? 0;
      const novelty = langMatters ? 0.65 / (1 + lc) + 0.35 / (1 + gc) : 1 / (1 + gc);
      // A softer, scaled penalty keeps diversity from overwhelming relevance.
      const val = c.score + w.diversity * novelty * 2 - (langMatters ? 0.02 * lc : 0);
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    const [choice] = pool.splice(bestIdx, 1);
    const lc = langCount.get(choice.movie.originalLanguage) ?? 0;
    const novelty = 1 / (1 + lc);
    choice.breakdown.diversity = novelty;
    choice.score = Math.round((choice.score + w.diversity * novelty) * 1000) / 1000;
    if (lc === 0 && picked.length > 0 && choice.movie.originalLanguage !== "en" && !q.languages.length) {
      choice.labels.push("New discovery");
    }
    langCount.set(choice.movie.originalLanguage, lc + 1);
    const g = choice.movie.genreIds[0] ?? -1;
    genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    picked.push(choice);
  }
  return picked;
}

export function rank(cands: Candidate[], q: DiscoveryQuery, opts: RankOptions = {}): ScoredMovie[] {
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const limit = opts.limit ?? 40;
  // Drop candidates that don't carry the requested moods at all.
  const scored = scoreCandidates(cands, q, opts).filter((s) => !q.moods.length || s.moodMatch >= 0.2);

  let ordered: ScoredMovie[];
  switch (q.sort) {
    case "rating":
      ordered = [...scored].sort((a, b) => b.breakdown.rating - a.breakdown.rating).slice(0, limit);
      break;
    case "popularity":
      ordered = [...scored].sort((a, b) => b.movie.popularity - a.movie.popularity).slice(0, limit);
      break;
    case "newest":
      ordered = [...scored].sort((a, b) => (b.movie.releaseDate ?? "").localeCompare(a.movie.releaseDate ?? "")).slice(0, limit);
      break;
    default:
      ordered = diversify(scored, q, w, limit);
  }
  for (const s of ordered) s.explanation = explain(s.movie, s.profile, q.moods, opts.taste);
  return ordered;
}
