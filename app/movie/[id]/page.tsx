import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { LibraryButtons } from "@/components/movie/LibraryButtons";
import { MoodDNA } from "@/components/mood/MoodDNA";
import { MoodChips } from "@/components/mood/MoodChips";
import { ReviewList } from "@/components/movie/ReviewList";
import { WatchOptions } from "@/components/movie/WatchOptions";
import { WhyThisMatches } from "@/components/movie/WhyThisMatches";
import { ExternalInfo } from "@/components/movie/ExternalInfo";
import { MovieRail } from "@/components/movie/MovieRail";
import { Poster } from "@/components/movie/Poster";
import { ConfigNotice, ErrorState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { getMovieDetail } from "@/lib/tmdb/movies";
import { TmdbError, TmdbNotConfiguredError } from "@/lib/tmdb/client";
import { getMoods, getStoredProfiles } from "@/lib/db/repository";
import { IMG } from "@/lib/tmdb/images";
import { lang, moviePath, rating, runtime, toLite, year } from "@/lib/format";
import { topMoods } from "@/lib/mood-engine/rules";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n";
import { logError } from "@/lib/logger";
import { cache } from "react";

export const revalidate = 21600;

const getDetail = cache(async (id: number) => {
  const movie = await getMovieDetail(id, env.defaultRegion);
  const stored = (await getStoredProfiles([id])).get(id);
  if (stored) movie.moodProfile = stored;
  return movie;
});

const idFrom = (raw: string) => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = idFrom((await params).id);
  if (!id) return { title: "Movie not found" };
  try {
    const m = await getDetail(id);
    const desc = m.overview ? m.overview.slice(0, 155) : `${m.title} on CineMood.`;
    const img = IMG.backdrop(m.backdropPath, "w1280") ?? IMG.poster(m.posterPath, "w500");
    return {
      title: `${m.title}${m.releaseDate ? ` (${year(m.releaseDate)})` : ""}`,
      description: desc,
      alternates: { canonical: moviePath(m) },
      openGraph: { title: m.title, description: desc, type: "video.movie", images: img ? [{ url: img }] : [] },
      twitter: { card: "summary_large_image", title: m.title, description: desc, images: img ? [img] : [] },
    };
  } catch {
    return { title: "Movie" };
  }
}

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = idFrom(raw);
  if (!id) notFound();

  let movie: Awaited<ReturnType<typeof getDetail>>;
  try {
    movie = await getDetail(id);
  } catch (e) {
    if (e instanceof TmdbNotConfiguredError)
      return (
        <div className="container">
          <ConfigNotice />
        </div>
      );
    if (e instanceof TmdbError && e.status === 404) notFound();
    logError("tmdb", "movie page failed", e);
    return (
      <div className="container">
        <ErrorState retryHref={`/movie/${raw}`} />
      </div>
    );
  }

  // Canonical slug URL for SEO (/movie/27205-inception)
  const canonical = moviePath(movie);
  if (`/movie/${raw}` !== canonical && !raw.includes("?")) permanentRedirect(canonical);

  const moods = await getMoods();
  const backdrop = IMG.backdrop(movie.backdropPath, "w1280");
  const lite = toLite(movie, movie.moodProfile);
  const meta = [year(movie.releaseDate), runtime(movie.runtime), lang(movie.originalLanguage), movie.countryNames.map((c) => c.name).slice(0, 2).join(", ")].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    alternateName: movie.originalTitle !== movie.title ? movie.originalTitle : undefined,
    datePublished: movie.releaseDate ?? undefined,
    description: movie.overview || undefined,
    image: IMG.poster(movie.posterPath, "w500") ?? undefined,
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
    genre: movie.genres.map((g) => g.name),
    inLanguage: movie.originalLanguage,
    countryOfOrigin: movie.countryNames.map((c) => ({ "@type": "Country", name: c.name })),
    director: movie.directors.map((d) => ({ "@type": "Person", name: d.name })),
    actor: movie.cast.slice(0, 6).map((c) => ({ "@type": "Person", name: c.name })),
    aggregateRating:
      movie.voteCount > 0 ? { "@type": "AggregateRating", ratingValue: movie.voteAverage.toFixed(1), bestRating: "10", ratingCount: movie.voteCount } : undefined,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="detail-hero">
        {backdrop && (
          <div className="detail-backdrop">
            <Image src={backdrop} alt="" fill priority sizes="100vw" />
          </div>
        )}
        <div className="container detail-hero-inner">
          <div className="detail-poster">
            <Poster path={movie.posterPath} title={movie.title} size="w500" priority sizes="240px" />
          </div>
          <div className="detail-title">
            <div className="chip-row" style={{ marginBottom: 16 }}>
              <MoodChips moods={topMoods(movie.moodProfile, 3).map((m) => m.mood)} />
            </div>
            <h1>{movie.title}</h1>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="detail-original">
                {t.movie.originalTitle}: <span lang={movie.originalLanguage}>{movie.originalTitle}</span>
              </p>
            )}
            {movie.tagline && <p className="detail-tagline">{movie.tagline}</p>}
            <div className="detail-meta">
              {movie.voteAverage > 0 && (
                <span className="rating" aria-label={`Rated ${rating(movie.voteAverage)} out of 10 from ${movie.voteCount} TMDB votes`}>
                  <Icon name="star" size={16} filled /> {rating(movie.voteAverage)}
                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>({movie.voteCount.toLocaleString("en")})</span>
                </span>
              )}
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="chip-row" style={{ marginTop: 14 }}>
              {movie.genres.map((g) => (
                <Link key={g.id} className="chip" href={`/genre/${g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  {g.name}
                </Link>
              ))}
            </div>
            <LibraryButtons movie={lite} />
            {movie.trailer && (
              <a className="btn btn-outline" style={{ marginTop: 10 }} href={`https://www.youtube.com/watch?v=${movie.trailer.key}`} target="_blank" rel="noreferrer">
                <Icon name="play" size={16} filled /> {t.movie.trailer}
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="container">
        <div className="detail-layout">
          <div style={{ minWidth: 0 }}>
            <section aria-labelledby="overview">
              <h2 id="overview" style={{ marginBottom: 14 }}>
                {t.movie.overview}
              </h2>
              <p className="prose">{movie.overview || "TMDB doesn't have a synopsis for this title yet."}</p>
            </section>

            <Suspense>
              <WhyThisMatches movie={movie} profile={movie.moodProfile} />
            </Suspense>

            <section className="section" aria-labelledby="dna">
              <h2 id="dna" style={{ marginBottom: 18 }}>
                {t.movie.dna}
              </h2>
              <MoodDNA profile={movie.moodProfile} moods={moods} />
            </section>

            {movie.cast.length > 0 && (
              <section className="section" aria-labelledby="cast">
                <h2 id="cast" style={{ marginBottom: 18 }}>
                  {t.movie.cast}
                </h2>
                <div className="cast" role="list">
                  {movie.cast.map((c) => {
                    const src = IMG.profile(c.profilePath);
                    return (
                      <div className="cast-member" role="listitem" key={`${c.id}-${c.order}`}>
                        <span className="cast-photo">{src ? <Image src={src} alt={c.name} fill sizes="112px" /> : <span aria-hidden>{c.name.slice(0, 1)}</span>}</span>
                        <strong>{c.name}</strong>
                        {c.character && <span>{c.character}</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="section" aria-labelledby="reviews">
              <h2 id="reviews" style={{ marginBottom: 14 }}>
                {t.movie.reviews}
              </h2>
              <ReviewList tmdbId={movie.tmdbId} initial={movie.reviews} total={movie.reviewTotal} />
            </section>
          </div>

          <aside>
            <div className="side-block">
              <h2>{t.movie.whereToWatch}</h2>
              <WatchOptions availability={movie.availability} region={env.defaultRegion} />
            </div>
            <Suspense fallback={<div className="side-block"><div className="skeleton sk-line" style={{ height: 120 }} /></div>}>
              <ExternalInfo imdbId={movie.imdbId} tmdbRating={movie.voteAverage} tmdbVotes={movie.voteCount} tmdbId={movie.tmdbId} />
            </Suspense>
            <div className="side-block">
              <h2>Details</h2>
              <dl className="facts">
                {movie.directors.length > 0 && (
                  <div>
                    <dt>{movie.directors.length > 1 ? t.movie.directors : t.movie.director}</dt>
                    <dd>{movie.directors.map((d) => d.name).join(", ")}</dd>
                  </div>
                )}
                {movie.writers.length > 0 && (
                  <div>
                    <dt>Writing</dt>
                    <dd>{[...new Set(movie.writers.map((w) => w.name))].join(", ")}</dd>
                  </div>
                )}
                <div>
                  <dt>Original language</dt>
                  <dd>{lang(movie.originalLanguage)}</dd>
                </div>
                {movie.spokenLanguages.length > 0 && (
                  <div>
                    <dt>{t.movie.spoken}</dt>
                    <dd>{movie.spokenLanguages.map((l) => l.name).join(", ")}</dd>
                  </div>
                )}
                {movie.countryNames.length > 0 && (
                  <div>
                    <dt>{t.movie.countries}</dt>
                    <dd>{movie.countryNames.map((c) => c.name).join(", ")}</dd>
                  </div>
                )}
                {movie.releaseDate && (
                  <div>
                    <dt>Release date</dt>
                    <dd>{new Date(movie.releaseDate).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}</dd>
                  </div>
                )}
                {movie.status && movie.status !== "Released" && (
                  <div>
                    <dt>Status</dt>
                    <dd>{movie.status}</dd>
                  </div>
                )}
                {movie.keywords.length > 0 && (
                  <div>
                    <dt>Keywords</dt>
                    <dd style={{ fontWeight: 500, color: "var(--text-2)" }}>{movie.keywords.slice(0, 10).join(", ")}</dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>

        <MovieRail title={t.movie.similar} subtitle="Recommended by viewers who watched this." movies={movie.similar} />
      </div>
    </article>
  );
}
