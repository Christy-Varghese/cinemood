import { NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/reference";

export function GET() {
  return NextResponse.json({ languages: LANGUAGES }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
}
