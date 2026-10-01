import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/security/admin";
import { supabaseAdmin } from "@/lib/db/supabase";
import { parseId } from "@/lib/api";
import { isMoodSlug } from "@/lib/moods/taxonomy";

const Body = z.object({
  title: z.string().min(1).max(300).optional(),
  overview: z.string().max(5000).optional(),
  is_hidden: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  /** Manual mood adjustments: slug → 0..1. Stored with source = 'manual' and never auto-overwritten. */
  moods: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

/** PATCH /api/admin/movies/:tmdbId */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req, "editor");
  if ("res" in gate) return gate.res;
  const tmdbId = parseId((await params).id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!tmdbId || !parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = supabaseAdmin()!;
  const { moods, ...fields } = parsed.data;
  const { data: movie } = await sb.from("movies").select("id").eq("tmdb_id", tmdbId).maybeSingle();
  if (!movie) return NextResponse.json({ error: "not_ingested", message: "Sync this movie first." }, { status: 404 });
  if (Object.keys(fields).length) await sb.from("movies").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", movie.id);
  if (moods) {
    const { data: all } = await sb.from("moods").select("id, slug");
    const idOf = new Map((all ?? []).map((m) => [m.slug as string, m.id as string]));
    const rows = Object.entries(moods)
      .filter(([slug]) => isMoodSlug(slug) && idOf.has(slug))
      .map(([slug, score]) => ({ movie_id: movie.id, mood_id: idOf.get(slug), score, confidence: 1, source: "manual", model_version: "manual", updated_at: new Date().toISOString() }));
    if (rows.length) await sb.from("movie_moods").upsert(rows, { onConflict: "movie_id,mood_id" });
  }
  return NextResponse.json({ ok: true });
}
