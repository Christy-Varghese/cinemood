import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/security/admin";
import { supabaseAdmin, getSessionUser } from "@/lib/db/supabase";
import { validateWeights } from "@/lib/recommendations/engine";
import { getActiveWeights, getFlags } from "@/lib/db/repository";

const Weights = z.object({
  mood: z.number().min(0).max(1),
  language: z.number().min(0).max(1),
  genre: z.number().min(0).max(1),
  preference: z.number().min(0).max(1),
  rating: z.number().min(0).max(1),
  popularity: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  diversity: z.number().min(0).max(1),
});
const Body = z.object({
  weights: Weights.optional(),
  note: z.string().max(200).optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
});

export async function GET(req: Request) {
  const gate = await requireAdmin(req, "moderator");
  if ("res" in gate) return gate.res;
  const sb = supabaseAdmin()!;
  const { data: versions } = await sb.from("recommendation_configs").select("id, version, weights, note, is_active, created_at").order("version", { ascending: false }).limit(20);
  return NextResponse.json({ weights: await getActiveWeights(), flags: await getFlags(), versions: versions ?? [] });
}

/** Saves a NEW config version (history is kept) and activates it. Weights must total 100%. */
export async function POST(req: Request) {
  const gate = await requireAdmin(req, "admin");
  if ("res" in gate) return gate.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = supabaseAdmin()!;
  const user = await getSessionUser();

  if (parsed.data.weights) {
    const check = validateWeights(parsed.data.weights);
    if (!check.ok) return NextResponse.json({ error: "weights_must_total_100", total: check.total }, { status: 422 });
    const { data: last } = await sb.from("recommendation_configs").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
    await sb.from("recommendation_configs").update({ is_active: false }).eq("is_active", true);
    await sb.from("recommendation_configs").insert({ version: (last?.version ?? 0) + 1, weights: parsed.data.weights, note: parsed.data.note ?? null, is_active: true, created_by: user?.id ?? null });
  }
  if (parsed.data.flags) {
    for (const [key, enabled] of Object.entries(parsed.data.flags)) {
      await sb.from("feature_flags").upsert({ key, enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
  }
  return NextResponse.json({ ok: true });
}
