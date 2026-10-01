import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/security/admin";
import { runSync } from "@/lib/sync/ingest";
import { apiError } from "@/lib/api";

const Body = z.object({
  kind: z.enum(["popular", "top_rated", "now_playing", "upcoming", "trending", "language", "region"]),
  pages: z.number().int().min(1).max(10).default(1),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  region: z.string().regex(/^[A-Z]{2}$/).optional(),
});

export const maxDuration = 300;

export async function POST(req: Request) {
  const gate = await requireAdmin(req, "admin");
  if ("res" in gate) return gate.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    return NextResponse.json(await runSync(parsed.data.kind, parsed.data));
  } catch (e) {
    return apiError(e, "admin");
  }
}
