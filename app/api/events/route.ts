import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";
import { badRequest, sameOrigin, tooMany } from "@/lib/api";
import { getSessionUser, supabaseAdmin } from "@/lib/db/supabase";
import { logError } from "@/lib/logger";

const EVENT_TYPES = [
  "page_view",
  "movie_view",
  "movie_like",
  "movie_dislike",
  "movie_save",
  "movie_remove",
  "movie_skip",
  "search",
  "mood_selected",
  "language_selected",
  "genre_selected",
  "recommendation_generated",
  "recommendation_clicked",
  "surprise_me",
  "watchlist_opened",
] as const;

const Body = z.object({
  type: z.enum(EVENT_TYPES),
  // Only small, non-personal metadata: ids, filter values, positions.
  metadata: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null(), z.array(z.union([z.string().max(40), z.number()])).max(10)])).default({}),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return badRequest();
  const rl = await rateLimit("events");
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const sb = supabaseAdmin();
  if (!sb) return new NextResponse(null, { status: 204 }); // analytics optional without a DB

  const user = await getSessionUser().catch(() => null);
  const { type, metadata } = parsed.data;
  const { error } = await sb.from("user_events").insert({
    user_id: user?.id ?? null,
    event_type: type,
    tmdb_id: typeof metadata.tmdbId === "number" ? metadata.tmdbId : null,
    metadata,
  });
  if (error) logError("events", "insert failed", error);
  return new NextResponse(null, { status: 204 });
}
