import Link from "next/link";
import { MovieCard } from "@/components/movie/MovieCard";
import { liteWithMoods } from "@/lib/movie-lite";
import { getSeasonMovies, seasonsNow } from "@/lib/trends/service";
import { isMoodSlug, moodToUrl, MOOD_SEED } from "@/lib/moods/taxonomy";
import { logError } from "@/lib/logger";
import type { Season } from "@/lib/trends/seasons";

/** Banner + rail for one season. Streams in under Suspense. */
export async function SeasonBlock({ season, compact = false, priority = false }: { season: Season; compact?: boolean; priority?: boolean }) {
  let movies: Awaited<ReturnType<typeof getSeasonMovies>> = [];
  try {
    movies = await getSeasonMovies(season);
  } catch (e) {
    logError("tmdb", `season ${season.slug} failed`, e);
    return null;
  }
  if (movies.length < 4) return null;
  const moods = season.moods.filter(isMoodSlug).map((slug) => MOOD_SEED.find((m) => m.slug === slug)!).filter(Boolean);
  const id = `season-${season.slug}`;
  return (
    <section className={`season-block${compact ? " is-compact" : ""}`} style={{ ["--season" as string]: season.accent }} aria-labelledby={id}>
      <div className="season-head">
        <span className="season-emoji" aria-hidden>
          {season.emoji}
        </span>
        <div className="season-copy">
          <p className="season-why">{season.why}</p>
          <h2 id={id}>{season.name}</h2>
          <p className="season-tagline">{season.tagline}</p>
          {!compact && moods.length > 0 && (
            <div className="chip-row" style={{ marginTop: 10 }}>
              {moods.map((m) => (
                <Link key={m.slug} href={`/mood/${moodToUrl(m.slug)}`} className="chip" style={{ ["--chip" as string]: m.accent }}>
                  {m.icon} {m.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="rail" role="list">
        {movies.slice(0, 20).map((m, i) => (
          <div role="listitem" key={m.tmdbId}>
            <MovieCard movie={liteWithMoods(m)} priority={priority && i < 4} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Home/Explore: the season that matters most today, plus chips for the others. */
export async function SeasonSpotlight({ priority = false }: { priority?: boolean }) {
  const [main, ...others] = seasonsNow();
  return (
    <div className="section">
      <SeasonBlock season={main} priority={priority} />
      <div className="season-more">
        {others.slice(0, 3).map((s) => (
          <Link key={s.slug} href={`/season#${s.slug}`} className="chip" style={{ ["--chip" as string]: s.accent }}>
            {s.emoji} Also in season: {s.name}
          </Link>
        ))}
        <Link href="/season" className="see-all">
          Everything in season →
        </Link>
      </div>
    </div>
  );
}
