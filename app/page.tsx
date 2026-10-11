import { Suspense } from "react";
import { MoodPicker } from "@/components/mood/MoodPicker";
import { HomePersonal } from "@/components/library/HomePersonal";
import { MovieRail } from "@/components/movie/MovieRail";
import { RailSkeleton } from "@/components/ui/States";
import { trendingBlend } from "@/lib/recommendations/service";
import { load } from "@/lib/load";
import { SeasonSpotlight } from "@/components/season/SeasonSpotlight";

export const revalidate = 3600;

async function TrendingStrip() {
  const res = await load(trendingBlend);
  if (!res.ok) return null; // the mood picker is the page; trending is a bonus
  return (
    <div className="container">
      <MovieRail
        title="What the world is watching"
        subtitle="Trending this week across every language."
        movies={res.data.slice(0, 16)}
        href="/trending"
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <MoodPicker />
      <Suspense
        fallback={
          <div className="container section">
            <RailSkeleton />
          </div>
        }
      >
        <div className="container">
          <SeasonSpotlight />
        </div>
      </Suspense>
      <HomePersonal />
      <Suspense
        fallback={
          <div className="container section">
            <RailSkeleton />
          </div>
        }
      >
        <TrendingStrip />
      </Suspense>
    </>
  );
}
