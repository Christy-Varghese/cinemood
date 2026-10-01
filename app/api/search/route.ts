import { NextResponse } from "next/server";
import { z } from "zod";
import { interpretQuery } from "@/lib/search/interpret";
import { searchByKeyword, searchMovies, searchPeopleMovies } from "@/lib/tmdb/movies";
import { rateLimit } from "@/lib/security/rate-limit";
import { apiError, badRequest, sameOrigin, tooMany } from "@/lib/api";
import { queryToParams } from "@/lib/search/query";
import { getFlags } from "@/lib/db/repository";

const Body = z.object({
  q: z.string().trim().min(1).max(200),
  mode: z.enum(["natural", "classic"]).default("natural"),
});

/**
 * Natural mode: interpret → structured filters (the client then requests
 * recommendations with them). Classic mode: title + person + keyword search.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return badRequest("Cross-origin request blocked");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Type something to search for.");
  const { q, mode } = parsed.data;

  const rl = await rateLimit(mode === "natural" ? "ai" : "search");
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    if (mode === "natural") {
      const flags = await getFlags();
      const { query, source } = await interpretQuery(q, flags.AI_SEARCH);
      if (!query.text) return NextResponse.json({ kind: "interpreted", query, params: queryToParams(query).toString(), source });
      // Nothing mood-like was found — fall through to classic search with the raw text.
    }
    const [titles, people, keyword] = await Promise.allSettled([searchMovies(q), searchPeopleMovies(q), searchByKeyword(q)]);
    if (titles.status === "rejected" && people.status === "rejected") throw titles.reason;
    return NextResponse.json({
      kind: "classic",
      titles: titles.status === "fulfilled" ? titles.value.results.slice(0, 20) : [],
      person: people.status === "fulfilled" ? people.value.person : null,
      personMovies: people.status === "fulfilled" ? people.value.movies.slice(0, 20) : [],
      keyword: keyword.status === "fulfilled" ? keyword.value.keyword : null,
      keywordMovies: keyword.status === "fulfilled" ? keyword.value.movies.slice(0, 20) : [],
    });
  } catch (e) {
    return apiError(e);
  }
}
