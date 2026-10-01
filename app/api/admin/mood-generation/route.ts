import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/security/admin";
import { supabaseAdmin } from "@/lib/db/supabase";
import { ingestMovie } from "@/lib/sync/ingest";
import { apiError } from "@/lib/api";

const Body = z.object({
  /** Regenerate specific movies, or classify up to `limit` movies with no profile yet. */
  tmdbIds: z.array(z.number().int().positive()).max(50).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const maxDuration = 300;

export async function POST(req: Request) {
  const gate = await requireAdmin(req, "editor");
  if ("res" in gate) return gate.res;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = supabaseAdmin()!;
  try {
    let ids = parsed.data.tmdbIds ?? [];
    if (!ids.length) {
      const { data } = await sb.from("movies_missing_moods").select("tmdb_id").limit(parsed.data.limit);
      ids = (data ?? []).map((r) => r.tmdb_id as number);
    }
    let done = 0;
    for (const id of ids) {
      await ingestMovie(id, { regenerateMoods: true });
      done++;
    }
    return NextResponse.json({ classified: done });
  } catch (e) {
    return apiError(e, "admin");
  }
}
