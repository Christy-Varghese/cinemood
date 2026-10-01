import { NextResponse } from "next/server";
import { z } from "zod";
import { recommend } from "@/lib/recommendations/service";
import { sanitizeTaste } from "@/lib/recommendations/taste";
import { queryFromParams, queryToParams } from "@/lib/search/query";
import { rateLimit } from "@/lib/security/rate-limit";
import { apiError, badRequest, sameOrigin, tooMany } from "@/lib/api";
import { supabaseAdmin, getSessionUser } from "@/lib/db/supabase";
import { getFlags } from "@/lib/db/repository";

const Body = z.object({
  /** URL-style params (moods=romantic,emotional&lang=ko …) — validated by queryFromParams. */
  params: z.string().max(1000).default(""),
  taste: z.unknown().optional(),
  limit: z.number().int().min(1).max(48).default(24),
  /** Swipe deck: page depth and already-seen ids. */
  deck: z.number().int().min(0).max(20).default(0),
  exclude: z.array(z.number().int().positive()).max(600).default([]),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return badRequest("Cross-origin request blocked");
  const rl = await rateLimit("recommend");
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const query = queryFromParams(new URLSearchParams(parsed.data.params));
  const flags = await getFlags();
  const taste = flags.PERSONALIZATION ? sanitizeTaste(parsed.data.taste) : null;

  try {
    const { results, poolSize } = await recommend(query, taste, parsed.data.limit, { deck: parsed.data.deck, exclude: parsed.data.exclude });
    const requestId = crypto.randomUUID();

    // Log for analytics / tuning (best effort, never blocks the response).
    const sb = supabaseAdmin();
    if (sb && results.length) {
      const user = await getSessionUser().catch(() => null);
      void sb
        .from("recommendation_logs")
        .insert(
          results.slice(0, 24).map((r, i) => ({
            user_id: user?.id ?? null,
            tmdb_id: r.movie.tmdbId,
            request_id: requestId,
            recommendation_score: r.score,
            ranking_position: i + 1,
            reason: { breakdown: r.breakdown, labels: r.labels, query: queryToParams(query).toString() },
          })),
        )
        .then(() => undefined);
    }

    return NextResponse.json({ query, results, total: results.length, poolSize, requestId });
  } catch (e) {
    return apiError(e, "recommendations");
  }
}
