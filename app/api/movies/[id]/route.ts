import { NextResponse } from "next/server";
import { getMovieDetail } from "@/lib/tmdb/movies";
import { getStoredProfiles } from "@/lib/db/repository";
import { apiError, badRequest, parseId } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return badRequest();
  const region = new URL(req.url).searchParams.get("region")?.match(/^[A-Z]{2}$/)?.[0];
  try {
    const movie = await getMovieDetail(id, region);
    const stored = (await getStoredProfiles([id])).get(id);
    if (stored) movie.moodProfile = stored;
    return NextResponse.json(movie, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    return apiError(e);
  }
}
