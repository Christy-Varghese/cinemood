import "server-only";
import { NextResponse } from "next/server";
import { getAdminRole, type AdminRole } from "@/lib/db/supabase";
import { rateLimit } from "@/lib/security/rate-limit";
import { sameOrigin } from "@/lib/api";
import { logError } from "@/lib/logger";

const RANK: Record<AdminRole, number> = { moderator: 1, editor: 2, admin: 3, super_admin: 4 };

/** Server-side admin gate for every /api/admin route. Returns a response to short-circuit, or the role. */
export async function requireAdmin(req: Request, min: AdminRole = "editor"): Promise<{ role: AdminRole } | { res: NextResponse }> {
  if (req.method !== "GET" && !sameOrigin(req)) return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const rl = await rateLimit("admin");
  if (!rl.ok) return { res: NextResponse.json({ error: "rate_limited" }, { status: 429 }) };
  const role = await getAdminRole();
  if (!role || RANK[role] < RANK[min]) {
    logError("auth", "admin access denied");
    return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { role };
}
