import { describe, expect, it } from "vitest";
import { genresForMood, ruleBasedProfile, topMoods } from "@/lib/mood-engine/rules";

describe("rule-based mood engine", () => {
  it("gives a weighted multi-mood profile, never a single label", () => {
    const p = ruleBasedProfile({ genreIds: [10749, 18], overview: "Two strangers fall in love as one of them faces a terminal illness." });
    expect(Object.keys(p.scores).length).toBeGreaterThan(3);
    expect(p.scores.romantic).toBeGreaterThan(0.8);
    expect(p.scores.emotional).toBeGreaterThan(0.7);
    expect(p.scores.sad).toBeGreaterThan(0.3);
  });

  it("keeps every score within 0..1 and records provenance", () => {
    const p = ruleBasedProfile({ genreIds: [27, 53, 9648, 80, 18], overview: "A detective investigates a serial killer in a haunted town; a twist reveals a time loop.", keywords: ["psychological", "revenge"] });
    for (const s of Object.values(p.scores)) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(p.source).toBe("rules");
    expect(p.modelVersion).toBe("rules-v1");
    expect(p.confidence).toBeGreaterThan(0.5);
  });

  it("lets keywords shift mood beyond genre (mood ≠ genre)", () => {
    const plain = ruleBasedProfile({ genreIds: [18] });
    const loop = ruleBasedProfile({ genreIds: [18], keywords: ["time loop", "nonlinear timeline"] });
    expect((loop.scores.mind_bending ?? 0) - (plain.scores.mind_bending ?? 0)).toBeGreaterThan(0.3);
  });

  it("maps fallback genres per the spec", () => {
    const comedy = ruleBasedProfile({ genreIds: [35] });
    expect(topMoods(comedy, 2).map((m) => m.mood)).toEqual(["funny", "happy"]);
    const horror = ruleBasedProfile({ genreIds: [27] });
    expect(horror.scores.scary).toBeGreaterThan(horror.scores.intense ?? 0);
  });

  it("finds retrieval genres for a mood", () => {
    expect(genresForMood("romantic")).toContain(10749);
    expect(genresForMood("scary")[0]).toBe(27);
  });
});
