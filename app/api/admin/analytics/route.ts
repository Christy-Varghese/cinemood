import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/admin";
import { getAdminOverview } from "@/lib/db/analytics";

export async function GET(req: Request) {
  const gate = await requireAdmin(req, "moderator");
  if ("res" in gate) return gate.res;
  return NextResponse.json(await getAdminOverview());
}
