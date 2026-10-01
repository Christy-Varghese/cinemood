import Link from "next/link";
import { MovieCard } from "@/components/movie/MovieCard";
import { liteWithMoods } from "@/lib/movie-lite";
import { getVintageTrending, vintageReason } from "@/lib/sources/buzz";
import { logError } from "@/lib/logger";

/** "Old is gold" rail — streams in under Suspense so it never blocks the page. */
export async function VintageRail() {
  let items: Awaited<ReturnType<typeof getVintageTrending>> = [];
  try {
    items = await getVintageTrending();
  } catch (e) {
    logError("sources", "vintage rail failed", e);
    return null;
  }
  if (items.length < 3) return null;
  return (
    <section className="section" aria-labelledby="rail-revival">
      <div className="section-head">
        <div>
          <h2 id="rail-revival">🔥 Old is gold — trending again</h2>
          <p>Older films suddenly back in the conversation, often thanks to a viral clip on Reels or TikTok.</p>
        </div>
        <Link className="see-all" href="/revival">
          See all
        </Link>
      </div>
      <div className="rail" role="list">
        {items.slice(0, 20).map((v) => (
          <div role="listitem" key={v.movie.tmdbId}>
            <MovieCard movie={liteWithMoods(v.movie)} explanation={vintageReason(v)} />
          </div>
        ))}
      </div>
    </section>
  );
}
