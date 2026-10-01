import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";
import { badRequest, parseId, sameOrigin } from "@/lib/api";

export async function DELETE(req: Request, { params }: { params: Promise<{ movieId: string }> }) {
  if (!sameOrigin(req)) return badRequest();
  const id = parseId((await params).movieId);
  if (!id) return badRequest();
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  await sb.from("watchlists").delete().eq("user_id", data.user.id).eq("tmdb_id", id);
  return NextResponse.json({ ok: true });
}
