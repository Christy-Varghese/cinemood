import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";
import { logError } from "@/lib/logger";

/** OAuth / magic-link callback: exchange the code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // Only allow same-site relative redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
  if (code) {
    const sb = await supabaseServer();
    const { error } = (await sb?.auth.exchangeCodeForSession(code)) ?? { error: null };
    if (error) {
      logError("auth", "code exchange failed", error);
      return NextResponse.redirect(new URL("/auth?error=callback", url.origin));
    }
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
