import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { MovieRail } from "@/components/movie/MovieRail";
import { ForYouRail } from "@/components/library/ForYouRail";
import { ConfigNotice, ErrorState, RailSkeleton } from "@/components/ui/States";
import { discover, getList } from "@/lib/tmdb/movies";
import { trendingBlend } from "@/lib/recommendations/service";
import { getMoods } from "@/lib/db/repository";
import { IMG } from "@/lib/tmdb/images";
import { LANGUAGES, languageSlug } from "@/lib/reference";
import { loadAll } from "@/lib/load";
import { moodToUrl } from "@/lib/moods/taxonomy";
import { lang, moviePath, rating, runtime, year } from "@/lib/format";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse movies by mood, language and what the world is watching right now.",
  alternates: { canonical: "/explore" },
};
export const revalidate = 3600;

const WORLD = [
  { code: "ko", title: "From Korea", sub: "Thrillers, melodramas and everything between." },
  { code: "ml", title: "Malayalam cinema", sub: "Grounded, character-driven stories from Kerala." },
  { code: "ja", title: "From Japan", sub: "Anime, quiet dramas and genre classics." },
  { code: "es", title: "In Spanish", sub: "From Spain, Mexico, Argentina and beyond." },
  { code: "fr", title: "French films", sub: "Romance, wit and the art-house." },
  { code: "hi", title: "Hindi cinema", sub: "Big-screen spectacle and new-wave drama." },
];

async function WorldRails() {
  const since = `${new Date().getFullYear() - 6}-01-01`;
  const res = await loadAll(
    Object.fromEntries(WORLD.map((w) => [w.code, () => discover({ language: w.code, minVotes: w.code === "ml" ? 15 : 60, releaseFrom: since, minRating: 6.3 })])) as Record<
      string,
      () => ReturnType<typeof discover>
    >,
  );
  if (!res.ok) return null;
  return (
    <>
      {WORLD.map((w) => {
        const list = res.data[w.code]?.results ?? [];
        return <MovieRail key={w.code} title={w.title} subtitle={w.sub} movies={list} href={`/language/${languageSlug(w.code)}`} />;
      })}
    </>
  );
}

async function MoreRails() {
  const res = await loadAll({
    now: () => getList("now_playing", 1, env.defaultRegion),
    upcoming: () => getList("upcoming", 1, env.defaultRegion),
    gems: () => discover({ sortBy: "vote_average.desc", minVotes: 150, maxVotes: 1500, minRating: 7.4 }),
    short: () => discover({ maxRuntime: 100, minRating: 7, minVotes: 400 }),
  });
  if (!res.ok) return null;
  const d = res.data;
  return (
    <>
      <MovieRail title="In theatres now" movies={d.now?.results ?? []} href="/movies?list=now_playing" />
      <MovieRail title="Hidden gems" subtitle="Loved by the people who found them — under 1,500 ratings, all above 7.4." movies={d.gems?.results ?? []} />
      <MovieRail title="Short and sweet" subtitle="Highly rated, and done in under 100 minutes." movies={d.short?.results ?? []} />
      <MovieRail title="Coming soon" movies={d.upcoming?.results ?? []} href="/movies?list=upcoming" />
    </>
  );
}

export default async function ExplorePage() {
  const [moods, trending] = await Promise.all([getMoods(), loadAll({ list: trendingBlend })]);
  if (!trending.ok && trending.reason === "config") {
    return (
      <div className="container">
        <ConfigNotice />
      </div>
    );
  }
  const list = trending.ok ? (trending.data.list ?? []) : [];
  const spot = list.find((m) => m.backdropPath && m.overview);

  return (
    <div className="container">
      <header className="page-head">
        <h1>Explore</h1>
        <p>Wander by mood, by language, or by what the world is watching tonight.</p>
      </header>

      {spot && (
        <section className="spotlight" aria-label={`Trending: ${spot.title}`}>
          <div className="bg">
            <Image src={IMG.backdrop(spot.backdropPath, "w1280")!} alt="" fill priority sizes="(max-width: 1320px) 100vw, 1320px" />
          </div>
          <div className="spotlight-body">
            <p className="kicker">Trending now</p>
            <h2>{spot.title}</h2>
            <p>{spot.overview}</p>
            <div className="detail-actions">
              <Link className="btn btn-primary" href={moviePath(spot)}>
                View details
              </Link>
              <span className="btn btn-ghost" aria-hidden>
                {[year(spot.releaseDate), lang(spot.originalLanguage), runtime(spot.runtime), `★ ${rating(spot.voteAverage)}`].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
        </section>
      )}

      <ForYouRail />

      <section className="section" aria-labelledby="by-mood">
        <div className="section-head">
          <div>
            <h2 id="by-mood">Browse by mood</h2>
            <p>Every mood is a weighted profile, not a genre — so &ldquo;Romantic&rdquo; includes more than romances.</p>
          </div>
          <Link className="see-all" href="/moods">
            All moods
          </Link>
        </div>
        <div className="explore-moods">
          {moods.slice(0, 10).map((m) => (
            <Link key={m.slug} href={`/mood/${moodToUrl(m.slug)}`} className="mood-card" style={{ ["--accent" as string]: m.accent }}>
              <span className="emoji" aria-hidden>
                {m.icon}
              </span>
              <strong>{m.name}</strong>
              <span>{m.description}</span>
            </Link>
          ))}
        </div>
      </section>

      {trending.ok ? <MovieRail title="Trending this week" subtitle="A blend of today's and this week's momentum." movies={list} href="/trending" priority /> : <ErrorState retryHref="/explore" />}

      <Suspense
        fallback={
          <div className="section">
            <RailSkeleton />
          </div>
        }
      >
        <WorldRails />
      </Suspense>

      <section className="section" aria-labelledby="langs">
        <div className="section-head">
          <h2 id="langs">More languages</h2>
          <Link className="see-all" href="/languages">
            All languages
          </Link>
        </div>
        <div className="lang-grid">
          {LANGUAGES.slice(0, 12).map((l) => (
            <Link key={l.code} href={`/language/${languageSlug(l.code)}`} className="lang-card">
              <span className="native">{l.nativeName}</span>
              <span className="en">{l.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <Suspense
        fallback={
          <div className="section">
            <RailSkeleton />
          </div>
        }
      >
        <MoreRails />
      </Suspense>
    </div>
  );
}
