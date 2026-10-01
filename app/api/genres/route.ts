import { NextResponse } from "next/server";
import { GENRES } from "@/lib/reference";
import { getGenres } from "@/lib/tmdb/movies";

export async function GET() {
  // Live TMDB names when available; stable ids either way.
  const genres = await getGenres().catch(() => GENRES.map(({ id, name }) => ({ id, name })));
  return NextResponse.json({ genres }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
}
