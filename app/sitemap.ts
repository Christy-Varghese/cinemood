import type { MetadataRoute } from "next";
import { MOOD_SEED, moodToUrl } from "@/lib/moods/taxonomy";
import { GENRES, LANGUAGES, languageSlug } from "@/lib/reference";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();
  return [
    ...["", "/explore", "/swipe", "/discover", "/moods", "/languages", "/trending", "/search", "/surprise", "/about"].map((p) => ({ url: `${base}${p}`, lastModified: now })),
    ...MOOD_SEED.map((m) => ({ url: `${base}/mood/${moodToUrl(m.slug)}`, lastModified: now })),
    ...LANGUAGES.map((l) => ({ url: `${base}/language/${languageSlug(l.code)}`, lastModified: now })),
    ...GENRES.map((g) => ({ url: `${base}/genre/${g.slug}`, lastModified: now })),
  ];
}
