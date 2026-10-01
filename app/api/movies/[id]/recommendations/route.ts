import { NextResponse } from "next/server";
import { getMovieDetail } from "@/lib/tmdb/movies";
import { moodNeighbours } from "@/lib/recommendations/service";
import { apiError, badRequest, parseId } from "@/lib/api";

/** Movies that feel like this one (by mood profile), not just share a genre. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return badRequest();
  try {
    const movie = await getMovieDetail(id);
    const results = await moodNeighbours(movie, movie.moodProfile, 12);
    return NextResponse.json({ results });
  } catch (e) {
    return apiError(e, "recommendations");
  }
}
