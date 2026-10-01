"use client";

import { useEffect, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { RailSkeleton } from "@/components/ui/States";
import { deriveTaste, library, useLibrary } from "@/lib/library/store";
import { toLite } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ScoredMovie } from "@/types/recommendation";

/** "Picked for your taste" — personalised ranking with no explicit mood, driven by history. */
export function ForYouRail() {
  const lib = useLibrary();
  const signals = Object.keys(lib.items).length + Object.keys(lib.reactions).length;
  const [results, setResults] = useState<ScoredMovie[] | null>(null);

  useEffect(() => {
    if (signals < 2) return;
    const taste = deriveTaste(library.get());
    // Lead with the user's strongest moods.
    const topMoods = Object.entries(taste.moods)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([m]) => m.replace(/_/g, "-"));
    const ctrl = new AbortController();
    fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: topMoods.length ? `moods=${topMoods.join(",")}` : "", taste, limit: 18 }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d: { results: ScoredMovie[] }) => setResults(d.results.filter((x) => !library.get().items[x.movie.tmdbId])))
      .catch(() => setResults([]));
    return () => ctrl.abort();
    // Recompute only when the amount of signal changes meaningfully.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(signals / 3)]);

  if (signals < 2) {
    return (
      <section className="section">
        <div className="notice">
          <span aria-hidden>🌱</span>
          <span>
            <strong>{t.empty.learning}</strong> {t.empty.learningHint}
          </span>
        </div>
      </section>
    );
  }
  return (
    <section className="section" aria-labelledby="for-you">
      <div className="section-head">
        <div>
          <h2 id="for-you">Picked for your taste</h2>
          <p>Ranked by the moods, languages and genres you save and like.</p>
        </div>
      </div>
      {results === null ? (
        <RailSkeleton />
      ) : (
        <div className="rail" role="list">
          {results.map((r) => (
            <div role="listitem" key={r.movie.tmdbId}>
              <MovieCard movie={toLite(r.movie, r.profile)} labels={r.labels} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
