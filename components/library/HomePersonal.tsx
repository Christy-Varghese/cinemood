"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { RailSkeleton } from "@/components/ui/States";
import { useLibrary } from "@/lib/library/store";
import { toLite } from "@/lib/format";
import type { ScoredMovie } from "@/types/recommendation";

/** Logged-in-style personal rails, driven by the local (or synced) library. */
export function HomePersonal() {
  const lib = useLibrary();
  const watchlist = useMemo(
    () =>
      Object.values(lib.items)
        .filter((i) => i.status === "want")
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [lib.items],
  );
  // Seed "Because you liked…" with the latest favorite, like, or watched title.
  const seed = useMemo(() => {
    const fav = Object.values(lib.items)
      .filter((i) => i.favorite || i.status === "watched")
      .sort((a, b) => (b.watchedAt ?? b.addedAt).localeCompare(a.watchedAt ?? a.addedAt))[0];
    if (fav) return fav;
    const likedId = Object.entries(lib.reactions).find(([, r]) => r === "like")?.[0];
    return likedId ? (lib.recent.find((r) => r.tmdbId === Number(likedId)) ?? null) : null;
  }, [lib.items, lib.reactions, lib.recent]);

  const [because, setBecause] = useState<ScoredMovie[] | null>(null);
  useEffect(() => {
    if (!seed) return;
    const ctrl = new AbortController();
    fetch(`/api/movies/${seed.tmdbId}/recommendations`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d: { results: ScoredMovie[] }) => setBecause(d.results.filter((x) => !lib.items[x.movie.tmdbId])))
      .catch(() => setBecause([]));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.tmdbId]);

  const recent = lib.recent.filter((r) => !lib.items[r.tmdbId]).slice(0, 12);
  if (!watchlist.length && !seed && !recent.length) return null;

  return (
    <div className="container">
      {seed && (
        <section className="section" aria-labelledby="because">
          <div className="section-head">
            <div>
              <h2 id="because">Because you liked {seed.title}</h2>
              <p>Movies with a similar mood profile.</p>
            </div>
          </div>
          {because === null ? (
            <RailSkeleton />
          ) : (
            <div className="rail" role="list">
              {because.map((r) => (
                <div role="listitem" key={r.movie.tmdbId}>
                  <MovieCard movie={toLite(r.movie, r.profile)} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {watchlist.length > 0 && (
        <section className="section" aria-labelledby="yourlist">
          <div className="section-head">
            <h2 id="yourlist">Your watchlist</h2>
            <Link className="see-all" href="/watchlist">
              See all {watchlist.length}
            </Link>
          </div>
          <div className="rail" role="list">
            {watchlist.slice(0, 16).map((m) => (
              <div role="listitem" key={m.tmdbId}>
                <MovieCard movie={m} />
              </div>
            ))}
          </div>
        </section>
      )}
      {recent.length > 0 && (
        <section className="section" aria-labelledby="continue">
          <div className="section-head">
            <h2 id="continue">Continue exploring</h2>
          </div>
          <div className="rail" role="list">
            {recent.map((m) => (
              <div role="listitem" key={m.tmdbId}>
                <MovieCard movie={m} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
