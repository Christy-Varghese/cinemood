import { describe, expect, it } from "vitest";
import { activeSeasons, nextSeason, nthWeekday } from "@/lib/trends/seasons";
import { genrePulse } from "@/lib/trends/genre-pulse";

const d = (s: string) => new Date(`${s}T15:00:00Z`);

describe("seasons", () => {
  it("finds Canadian Thanksgiving (2nd Monday of October)", () => {
    expect(nthWeekday(2026, 10, 1, 2).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(nthWeekday(2026, 11, 4, 4).toISOString().slice(0, 10)).toBe("2026-11-26");
  });
  it("features Thanksgiving then spooky season in Canada on Oct 11", () => {
    const s = activeSeasons(d("2026-10-11"), "CA").map((x) => x.slug);
    expect(s.slice(0, 2)).toEqual(["thanksgiving-ca", "spooky-season"]);
    expect(s).toContain("cozy-autumn");
  });
  it("respects regions", () => {
    expect(activeSeasons(d("2026-10-11"), "US").map((x) => x.slug)).not.toContain("thanksgiving-ca");
  });
  it("covers the calendar", () => {
    expect(activeSeasons(d("2026-12-20"))[0].slug).toBe("holiday-season");
    expect(activeSeasons(d("2027-02-10"))[0].slug).toBe("valentines");
    expect(activeSeasons(d("2027-07-04"))[0].slug).toBe("summer-blockbusters");
    expect(activeSeasons(d("2026-10-30"))[0].slug).toBe("halloween-night");
    expect(activeSeasons(d("2026-11-06")).map((x) => x.slug)).toContain("diwali");
  });
  it("always returns something", () => {
    for (let t = d("2026-01-01").getTime(); t < d("2027-01-01").getTime(); t += 86_400_000) expect(activeSeasons(new Date(t)).length).toBeGreaterThan(0);
  });
  it("previews the next season", () => {
    const n = nextSeason(d("2026-10-11"), "CA");
    expect(n?.season.slug).toBe("halloween-night");
  });
});

describe("genre pulse", () => {
  it("flags genres trending above their usual share", () => {
    const horror = { genreIds: [27] };
    const drama = { genreIds: [18] };
    const trending = [horror, horror, drama, horror, drama];
    const baseline = [drama, drama, drama, drama, horror, drama, drama, drama];
    const p = genrePulse(trending, baseline);
    expect(p[0].id).toBe(27);
    expect(p[0].lift).toBeGreaterThan(2);
    expect(p.find((x) => x.id === 18)!.lift).toBeLessThan(1);
  });
});
