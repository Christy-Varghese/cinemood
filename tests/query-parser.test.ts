import { describe, expect, it } from "vitest";
import { parseNaturalLanguage, queryFromParams, queryToParams } from "@/lib/search/query";

describe("natural-language query parsing", () => {
  it("funny and romantic", () => {
    const q = parseNaturalLanguage("I want something funny and romantic.");
    expect(q.moods).toEqual(expect.arrayContaining(["funny", "romantic"]));
    expect(q.text).toBeNull();
  });

  it("dark Korean thriller", () => {
    const q = parseNaturalLanguage("Give me a dark Korean thriller.");
    expect(q.languages).toEqual(["ko"]);
    expect(q.moods).toContain("dark");
    expect(q.genres).toContain(53);
  });

  it("emotional Malayalam movie", () => {
    const q = parseNaturalLanguage("I want an emotional Malayalam movie.");
    expect(q.languages).toEqual(["ml"]);
    expect(q.moods).toEqual(["emotional"]);
  });

  it("relaxing Sunday evening", () => {
    expect(parseNaturalLanguage("Something relaxing for a Sunday evening.").moods).toContain("relaxing");
  });

  it("blow my mind", () => {
    expect(parseNaturalLanguage("I want a movie that will blow my mind.").moods).toContain("mind_bending");
  });

  it("uplifting under two hours", () => {
    const q = parseNaturalLanguage("Give me an uplifting movie under two hours.");
    expect(q.moods).toContain("inspiring");
    expect(q.maxRuntime).toBe(120);
  });

  it("negation removes a mood", () => {
    const q = parseNaturalLanguage("something funny but not scary");
    expect(q.moods).toContain("funny");
    expect(q.moods).not.toContain("scary");
  });

  it("decades and ratings", () => {
    const q = parseNaturalLanguage("a highly rated 90s romantic comedy");
    expect(q.minYear).toBe(1990);
    expect(q.maxYear).toBe(1999);
    expect(q.minRating).toBe(7.5);
  });

  it("caps moods at three", () => {
    expect(parseNaturalLanguage("happy sad scary funny romantic").moods.length).toBeLessThanOrEqual(3);
  });

  it("falls back to text search when nothing mood-like is found", () => {
    const q = parseNaturalLanguage("Inception");
    expect(q.text).toBe("Inception");
  });
});

describe("filter params", () => {
  it("round-trips and validates", () => {
    const p = queryToParams({ moods: ["mind_bending", "dark"], languages: ["ko"], genres: [53], maxRuntime: 120, minRating: 7, availability: "stream" });
    expect(p.get("moods")).toBe("mind-bending,dark");
    const back = queryFromParams(p);
    expect(back.moods).toEqual(["mind_bending", "dark"]);
    expect(back.languages).toEqual(["ko"]);
    expect(back.availability).toBe("stream");
  });

  it("drops invalid input", () => {
    const q = queryFromParams(new URLSearchParams("moods=evil,romantic&lang=xx,ko&genres=1,28&maxRuntime=9999&minRating=42&sort=bogus&where=pirate"));
    expect(q.moods).toEqual(["romantic"]);
    expect(q.languages).toEqual(["ko"]);
    expect(q.genres).toEqual([28]);
    expect(q.maxRuntime).toBeNull();
    expect(q.minRating).toBeNull();
    expect(q.sort).toBe("recommended");
    expect(q.availability).toBe("any");
  });
});
