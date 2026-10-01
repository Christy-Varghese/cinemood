import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { logError } from "@/lib/logger";

/**
 * Wikidata — free, no key, CC0. Gives the awards a film actually won,
 * its nomination count and its English Wikipedia article.
 * Cached for a week; Wikidata asks for a descriptive User-Agent.
 */
const Binding = z.object({ value: z.string() });
const SparqlSchema = z.object({
  results: z.object({
    bindings: z.array(z.object({ film: Binding, article: Binding.optional(), awards: Binding.optional(), nominations: Binding.optional() })),
  }),
});

export interface WikidataInfo {
  wikidataUrl: string;
  wikipediaUrl: string | null;
  awards: string[];
  nominations: number;
}

/** Most prestigious first: the big festivals and academies before regional prizes. */
const PRESTIGE = [/academy award|oscar/i, /palme d'or|golden lion|golden bear/i, /bafta/i, /golden globe/i, /cannes|venice|berlin/i, /national film award/i, /filmfare|kerala state|blue dragon|grand bell|japan academy/i];
const prestige = (a: string) => {
  const i = PRESTIGE.findIndex((re) => re.test(a));
  return i === -1 ? PRESTIGE.length : i;
};

export async function getWikidataInfo(imdbId: string | null): Promise<WikidataInfo | null> {
  if (!imdbId || !/^tt\d{5,10}$/.test(imdbId)) return null;
  const query = `SELECT ?film ?article (GROUP_CONCAT(DISTINCT ?awardLabel; separator="|") AS ?awards) (COUNT(DISTINCT ?nom) AS ?nominations) WHERE {
  ?film wdt:P345 "${imdbId}" .
  OPTIONAL { ?film wdt:P166 ?award . ?award rdfs:label ?awardLabel . FILTER(LANG(?awardLabel) = "en") }
  OPTIONAL { ?film wdt:P1411 ?nom . }
  OPTIONAL { ?article schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> . }
} GROUP BY ?film ?article LIMIT 1`;
  try {
    const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": `CineMood/1.0 (${env.appUrl}; movie discovery app)` },
      next: { revalidate: 60 * 60 * 24 * 7, tags: ["wikidata"] },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    const parsed = SparqlSchema.safeParse(await res.json());
    const row = parsed.success ? parsed.data.results.bindings[0] : undefined;
    if (!row) return null;
    const awards = (row.awards?.value ?? "")
      .split("|")
      .map((a) => a.trim())
      .filter(Boolean)
      .sort((a, b) => prestige(a) - prestige(b));
    return {
      wikidataUrl: row.film.value.replace("http://", "https://"),
      wikipediaUrl: row.article?.value ?? null,
      awards,
      nominations: Number(row.nominations?.value ?? 0) || 0,
    };
  } catch (e) {
    logError("tmdb", "Wikidata lookup failed", e);
    return null;
  }
}
