import { NextResponse } from "next/server";
import { getReviews } from "@/lib/tmdb/movies";
import { apiError, badRequest, parseId } from "@/lib/api";

/** Paginated TMDB user reviews — shown verbatim with author attribution and a link to the source. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return badRequest();
  const page = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1));
  try {
    return NextResponse.json(await getReviews(id, page), { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (e) {
    return apiError(e);
  }
}
