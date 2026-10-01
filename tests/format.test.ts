import { describe, expect, it } from "vitest";
import { moviePath, personPath } from "@/lib/format";

describe("paths", () => {
  it("builds SEO person paths", () => {
    expect(personPath({ id: 6193, name: "Leonardo DiCaprio" })).toBe("/person/6193-leonardo-dicaprio");
    expect(personPath({ id: 1, name: "Penélope Cruz" })).toBe("/person/1-penelope-cruz");
    expect(personPath({ id: 2, name: "മമ്മൂട്ടി" })).toBe("/person/2");
  });
  it("keeps movie paths stable", () => {
    expect(moviePath({ tmdbId: 27205, title: "Inception" })).toBe("/movie/27205-inception");
  });
});
