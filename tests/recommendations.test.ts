import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, diversify, explain, moodMatch, rank, ratingQuality, scoreCandidates, validateWeights, type Candidate } from "@/lib/recommendations/engine";
import { EMPTY_QUERY } from "@/lib/search/query";
import type { MoodProfile } from "@/types/mood";
import type { MovieSummary } from "@/types/movie";
import type { DiscoveryQuery } from "@/types/recommendation";

// Synthetic test fixtures only (not real movies) — engine behaviour, not data.
let nextId = 1;
function movie(p: Partial<MovieSummary> = {}): MovieSummary {
  return {
    tmdbId: nextId++,
    title: `Test film ${nextId}`,
    originalTitle: "",
    originalLanguage: "en",
    overview: "",
    posterPath: null,
    backdropPath: null,
    releaseDate: "2018-05-01",
    voteAverage: 7.2,
    voteCount: 3000,
    popularity: 40,
    genreIds: [18],
    ...p,
  };
}
const profile = (scores: MoodProfile["scores"]): MoodProfile => ({ scores, confidence: 0.8, source: "rules", modelVersion: "test", calculatedAt: "2026-01-01" });
const q = (p: Partial<DiscoveryQuery>): DiscoveryQuery => ({ ...EMPTY_QUERY, moods: [], languages: [], genres: [], ...p });

describe("recommendation scoring", () => {
  it("default weights total 100%", () => {
    expect(validateWeights(DEFAULT_WEIGHTS).ok).toBe(true);
    expect(validateWeights({ ...DEFAULT_WEIGHTS, mood: 0.5 }).ok).toBe(false);
  });

  it("rewards movies strong in ALL requested moods over one-mood movies", () => {
    const both = moodMatch(profile({ romantic: 0.85, emotional: 0.8 }), ["romantic", "emotional"]);
    const oneSided = moodMatch(profile({ romantic: 0.98, emotional: 0.1 }), ["romantic", "emotional"]);
    expect(both).toBeGreaterThan(oneSided);
  });

  it("shrinks low-vote ratings toward the mean", () => {
    expect(ratingQuality(movie({ voteAverage: 9.5, voteCount: 8 }))).toBeLessThan(ratingQuality(movie({ voteAverage: 8.4, voteCount: 20000 })));
  });

  it("ranks the better mood match first", () => {
    const a: Candidate = { movie: movie(), profile: profile({ romantic: 0.9, emotional: 0.85 }) };
    const b: Candidate = { movie: movie(), profile: profile({ romantic: 0.3, exciting: 0.9 }) };
    const out = rank([b, a], q({ moods: ["romantic", "emotional"] }));
    expect(out[0].movie.tmdbId).toBe(a.movie.tmdbId);
    expect(out[0].labels).toContain("Great mood match");
  });

  it("excludes watched movies and halves disliked ones", () => {
    const a: Candidate = { movie: movie(), profile: profile({ funny: 0.9 }) };
    const b: Candidate = { movie: movie(), profile: profile({ funny: 0.9 }) };
    const taste = { moods: {}, languages: {}, genres: {}, negative: [b.movie.tmdbId], watched: [a.movie.tmdbId] };
    const scored = scoreCandidates([a, b], q({ moods: ["funny"] }), { taste });
    expect(scored.map((s) => s.movie.tmdbId)).toEqual([b.movie.tmdbId]);
    const neutral = scoreCandidates([b], q({ moods: ["funny"] }));
    expect(scored[0].score).toBeCloseTo(neutral[0].score / 2, 5);
  });

  it("personalizes toward preferred languages", () => {
    const ko: Candidate = { movie: movie({ originalLanguage: "ko" }), profile: profile({ intense: 0.8 }) };
    const fr: Candidate = { movie: movie({ originalLanguage: "fr" }), profile: profile({ intense: 0.8 }) };
    const taste = { moods: {}, languages: { ko: 5 }, genres: {}, negative: [], watched: [] };
    const out = scoreCandidates([fr, ko], q({ moods: ["intense"] }), { taste });
    const koScore = out.find((s) => s.movie.originalLanguage === "ko")!.score;
    const frScore = out.find((s) => s.movie.originalLanguage === "fr")!.score;
    expect(koScore).toBeGreaterThan(frScore);
  });

  it("explanations use only metadata and scores", () => {
    const m = movie({ originalLanguage: "ml", genreIds: [18, 10749], releaseDate: "2022-03-01", runtime: 128 });
    const text = explain(m, profile({ romantic: 0.9, emotional: 0.8 }), ["romantic", "emotional"]);
    expect(text).toContain("Malayalam");
    expect(text).toContain("2022");
    expect(text).toContain("128 min");
    expect(text).toMatch(/romantic and emotional/);
  });
});

describe("diversity re-rank", () => {
  it("introduces other languages when the top results are all one language", () => {
    const cands: Candidate[] = [
      ...Array.from({ length: 8 }, () => ({ movie: movie({ originalLanguage: "en", popularity: 90 }), profile: profile({ emotional: 0.92 }) })),
      { movie: movie({ originalLanguage: "ko" }), profile: profile({ emotional: 0.85 }) },
      { movie: movie({ originalLanguage: "ml" }), profile: profile({ emotional: 0.84 }) },
      { movie: movie({ originalLanguage: "ja" }), profile: profile({ emotional: 0.83 }) },
    ];
    const query = q({ moods: ["emotional"] });
    const out = diversify(scoreCandidates(cands, query), query, DEFAULT_WEIGHTS, 6);
    const langs = new Set(out.map((s) => s.movie.originalLanguage));
    expect(langs.size).toBeGreaterThanOrEqual(3);
    expect(out[0].moodMatch).toBeGreaterThan(0.8); // relevance kept
  });

  it("does not inject other languages when the user fixed one", () => {
    const cands: Candidate[] = [
      ...Array.from({ length: 5 }, () => ({ movie: movie({ originalLanguage: "ko" }), profile: profile({ romantic: 0.9 }) })),
    ];
    const query = q({ moods: ["romantic"], languages: ["ko"] });
    const out = rank(cands, query, { limit: 5 });
    expect(out.every((s) => s.movie.originalLanguage === "ko")).toBe(true);
  });
});
