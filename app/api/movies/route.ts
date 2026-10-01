import { NextResponse } from "next/server";
import { getList, getTrending, discover } from "@/lib/tmdb/movies";
import { apiError } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { tooMany } from "@/lib/api";

/** GET /api/movies?list=popular|top_rated|now_playing|upcoming|trending&page=1&lang=ko */
export async function GET(req: Request) {
  const rl = await rateLimit("search");
  if (!rl.ok) return tooMany(rl.retryAfter);
  const sp = new URL(req.url).searchParams;
  const list = sp.get("list") ?? "popular";
  const page = Math.min(500, Math.max(1, Number(sp.get("page")) || 1));
  const lang = sp.get("lang")?.match(/^[a-z]{2}$/)?.[0];
  try {
    const data =
      list === "trending"
        ? await getTrending("week", page)
        : lang
          ? await discover({ language: lang, page, minVotes: 20 })
          : ["popular", "top_rated", "now_playing", "upcoming"].includes(list)
            ? await getList(list as "popular", page)
            : null;
    if (!data) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
  } catch (e) {
    return apiError(e);
  }
}
