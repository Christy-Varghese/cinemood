import type { Metadata } from "next";
import { Suspense } from "react";
import { VintageRail } from "@/components/revival/VintageRail";
import { MovieRail } from "@/components/movie/MovieRail";
import { ConfigNotice, ErrorState, RailSkeleton } from "@/components/ui/States";
import { discover, getList } from "@/lib/tmdb/movies";
import { trendingBlend, traktWatchingNow } from "@/lib/recommendations/service";
import { ruleBasedProfile } from "@/lib/mood-engine/rules";
import { getMoods } from "@/lib/db/repository";
import { loadAll } from "@/lib/load";
import { env } from "@/lib/env";
import { REGIONS, languageName } from "@/lib/reference";
import type { MovieSummary } from "@/types/movie";

export const metadata: Metadata = { title: "Trending", description: "What the world is watching — globally, in your region, by language and by mood.", alternates: { canonical: "/trending" } };
export const revalidate = 3600;

export default async function TrendingPage() {
  const since = `${new Date().getFullYear() - 1}-01-01`;
  const res = await loadAll({
    global: trendingBlend,
    trakt: () => traktWatchingNow(20),
    regional: () => getList("now_playing", 1, env.defaultRegion),
    ko: () => discover({ language: "ko", releaseFrom: since, minVotes: 10 }),
    hi: () => discover({ language: "hi", releaseFrom: since, minVotes: 5 }),
    ml: () => discover({ language: "ml", releaseFrom: since, minVotes: 3 }),
    ja: () => discover({ language: "ja", releaseFrom: since, minVotes: 10 }),
  });
  if (!res.ok) return <div className="container">{res.reason === "config" ? <ConfigNotice /> : <ErrorState retryHref="/trending" />}</div>;

  const global = res.data.global ?? [];
  const moods = (await getMoods()).filter((m) => m.featured).slice(0, 6);
  // Trending by mood: bucket the global trend by each movie's strongest moods.
  const byMood = moods.map((m) => ({
    mood: m,
    list: global
      .map((mv) => ({ mv, s: ruleBasedProfile({ genreIds: mv.genreIds, overview: mv.overview }).scores[m.slug] ?? 0 }))
      .filter((x) => x.s >= 0.55)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.mv as MovieSummary),
  }));
  const regionName = REGIONS.find((r) => r.code === env.defaultRegion)?.name ?? env.defaultRegion;

  return (
    <div className="container">
      <header className="page-head">
        <h1>Trending</h1>
        <p>Blended from today&apos;s and this week&apos;s momentum — then sliced by region, language and mood.</p>
      </header>
      <MovieRail title="Trending globally" subtitle="TMDB momentum blended with what Trakt members are watching." movies={global} priority />
      <Suspense fallback={<div className="section"><RailSkeleton /></div>}>
        <VintageRail />
      </Suspense>
      <MovieRail title="Watching right now on Trakt" subtitle="Live from the Trakt community." movies={res.data.trakt ?? []} />
      <MovieRail title={`In theatres in ${regionName}`} movies={res.data.regional?.results ?? []} />
      {(["ko", "ml", "hi", "ja"] as const).map((code) => (
        <MovieRail key={code} title={`Trending in ${languageName(code)}`} movies={res.data[code]?.results ?? []} href={`/language/${languageName(code).toLowerCase()}`} />
      ))}
      {byMood.map(({ mood, list }) => (
        <MovieRail key={mood.slug} title={`Trending & ${mood.name.toLowerCase()} ${mood.icon}`} movies={list} />
      ))}
    </div>
  );
}
