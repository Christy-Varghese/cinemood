import { NextResponse } from "next/server";
import { getMoods } from "@/lib/db/repository";

export async function GET() {
  const moods = await getMoods();
  return NextResponse.json({ moods }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
