import Link from "next/link";
import { MovieCard } from "./MovieCard";
import { liteWithMoods } from "@/lib/movie-lite";
import type { MovieSummary } from "@/types/movie";

export function MovieRail({ title, subtitle, movies, href, priority = false }: { title: string; subtitle?: string; movies: MovieSummary[]; href?: string; priority?: boolean }) {
  if (!movies.length) return null;
  const id = `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {href && (
          <Link className="see-all" href={href}>
            See all
          </Link>
        )}
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

export function MovieGrid({ movies }: { movies: MovieSummary[] }) {
  return (
    <div className="grid" role="list">
      {movies.map((m, i) => (
        <div role="listitem" key={m.tmdbId}>
          <MovieCard movie={liteWithMoods(m)} priority={i < 6} />
        </div>
      ))}
    </div>
  );
}
