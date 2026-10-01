"use client";

import { useMemo, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { liteWithMoods } from "@/lib/movie-lite";
import type { MovieSummary } from "@/types/movie";

export interface RevivalEntry {
  movie: MovieSummary;
  reason: string;
  spike: number | null;
}

const ERAS = [
  { id: "all", label: "All eras", test: () => true },
  { id: "2000s", label: "2000s & 2010s", test: (y: number) => y >= 2000 },
  { id: "90s", label: "90s", test: (y: number) => y >= 1990 && y < 2000 },
  { id: "80s", label: "80s", test: (y: number) => y >= 1980 && y < 1990 },
  { id: "classic", label: "Before 1980", test: (y: number) => y < 1980 },
] as const;

export function RevivalGrid({ entries }: { entries: RevivalEntry[] }) {
  const [era, setEra] = useState<(typeof ERAS)[number]["id"]>("all");
  const counts = useMemo(
    () => Object.fromEntries(ERAS.map((e) => [e.id, entries.filter((x) => e.test(Number(x.movie.releaseDate?.slice(0, 4) ?? 0))).length])),
    [entries],
  );
  const shown = entries.filter((x) => ERAS.find((e) => e.id === era)!.test(Number(x.movie.releaseDate?.slice(0, 4) ?? 0)));

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Era" style={{ margin: "6px 0 26px" }}>
        {ERAS.filter((e) => e.id === "all" || counts[e.id] > 0).map((e) => (
          <button key={e.id} role="tab" className="tab" aria-selected={era === e.id} onClick={() => setEra(e.id)}>
            {e.label} <span className="tab-count">{counts[e.id]}</span>
          </button>
        ))}
      </div>
      <div className="grid" role="list">
        {shown.map((x, i) => (
          <div role="listitem" key={x.movie.tmdbId} className="revival-cell">
            {x.spike && x.spike >= 2 && (
              <span className="hot-badge" title="Wikipedia interest compared with its usual level">
                🔥 {x.spike.toFixed(1)}×
              </span>
            )}
            <MovieCard movie={liteWithMoods(x.movie)} explanation={x.reason} priority={i < 6} />
          </div>
        ))}
      </div>
    </>
  );
}
