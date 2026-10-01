import { NextResponse } from "next/server";
import { z } from "zod";
import { recommend } from "@/lib/recommendations/service";
import { sanitizeTaste } from "@/lib/recommendations/taste";
import { queryFromParams } from "@/lib/search/query";
import { rateLimit } from "@/lib/security/rate-limit";
import { apiError, badRequest, sameOrigin, tooMany } from "@/lib/api";
import { getMovieDetail } from "@/lib/tmdb/movies";

const Body = z.object({
  params: z.string().max(1000).default(""),
  exclude: z.array(z.number().int().positive()).max(300).default([]),
  taste: z.unknown().optional(),
});

/**
 * Surprise Me: rank the pool, then sample from the top band with weights
 * (so it's a *good* surprise, not a random one), excluding recent skips.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return badRequest();
  const rl = await rateLimit("recommend");
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const query = queryFromParams(new URLSearchParams(parsed.data.params));
  const exclude = new Set(parsed.data.exclude);
  try {
    const { results } = await recommend(query, sanitizeTaste(parsed.data.taste), 36);
    const band = results.filter((r) => !exclude.has(r.movie.tmdbId)).slice(0, 15);
    if (!band.length) return NextResponse.json({ pick: null });
    const total = band.reduce((a, r) => a + r.score ** 2, 0);
    let roll = Math.random() * total;
    let pick = band[0];
    for (const r of band) {
      roll -= r.score ** 2;
      if (roll <= 0) {
        pick = r;
        break;
      }
    }
    const detail = await getMovieDetail(pick.movie.tmdbId).catch(() => null);
    return NextResponse.json({
      pick,
      detail: detail && { tagline: detail.tagline, directors: detail.directors.map((d) => d.name), trailer: detail.trailer, cast: detail.cast.slice(0, 4).map((c) => c.name) },
    });
  } catch (e) {
    return apiError(e, "recommendations");
  }
}
