import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/db/supabase";
import { badRequest, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { logError } from "@/lib/logger";

/** Deletes the signed-in user's account. Their rows cascade via FK `on delete cascade`. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return badRequest();
  const rl = await rateLimit("auth");
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const sb = await supabaseServer();
  const admin = supabaseAdmin();
  if (!sb || !admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) {
    logError("auth", "account deletion failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
