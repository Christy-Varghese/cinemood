"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { Poster } from "@/components/movie/Poster";
import { Icon } from "@/components/ui/Icon";
import { liteWithMoods } from "@/lib/movie-lite";
import { lang, moviePath, rating, year } from "@/lib/format";
import { library, useLibrary } from "@/lib/library/store";
import type { MovieSummary } from "@/types/movie";

export interface FilmCredit {
  movie: MovieSummary;
  departments: string[];
  roles: string[];
}

type View = "grid" | "list";
type Sort = "newest" | "popular" | "rating" | "oldest";

const SORTS: { id: Sort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "popular", label: "Most popular" },
  { id: "rating", label: "Top rated" },
  { id: "oldest", label: "Oldest" },
];
const VIEW_KEY = "cinemood:filmography-view";
const today = new Date().toISOString().slice(0, 10);

/** Role text shown under a title: "as Cobb", "Director · Writer". */
function roleLabel(c: FilmCredit, dept: string) {
  if (dept === "Acting" || (dept === "All" && c.departments.includes("Acting"))) {
    const chars = c.departments.includes("Acting") ? c.roles.filter(Boolean) : [];
    if (chars.length) return `as ${chars.slice(0, 2).join(" / ")}`;
  }
  return c.roles.slice(0, 3).join(" · ");
}

export function Filmography({ name, credits, knownFor }: { name: string; credits: FilmCredit[]; knownFor: string }) {
  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of credits) for (const d of c.departments) counts.set(d, (counts.get(d) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => (a[0] === knownFor ? -1 : b[0] === knownFor ? 1 : b[1] - a[1]));
  }, [credits, knownFor]);

  const [dept, setDept] = useState<string>(departments[0]?.[0] ?? "All");
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<View>("grid");
  const lib = useLibrary();

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      if (v === "grid" || v === "list") setView(v);
    } catch {
      /* storage unavailable — keep default */
    }
  }, []);
  const chooseView = (v: View) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const list = useMemo(() => {
    const filtered = dept === "All" ? credits : credits.filter((c) => c.departments.includes(dept));
    const d = (c: FilmCredit) => c.movie.releaseDate ?? "9999";
    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => d(b).localeCompare(d(a)));
    if (sort === "oldest") sorted.sort((a, b) => (a.movie.releaseDate ?? "9999").localeCompare(b.movie.releaseDate ?? "9999"));
    if (sort === "popular") sorted.sort((a, b) => b.movie.popularity - a.movie.popularity);
    // Bayesian-ish: films with only a handful of votes shouldn't top the list.
    if (sort === "rating") sorted.sort((a, b) => score(b.movie) - score(a.movie));
    return sorted;
  }, [credits, dept, sort]);

  if (!credits.length) return <p className="muted-note">TMDB has no film credits for {name} yet.</p>;

  return (
    <div>
      <div className="filmo-bar">
        <div className="tabs" role="tablist" aria-label="Department">
          {departments.length > 1 && (
            <button role="tab" className="tab" aria-selected={dept === "All"} onClick={() => setDept("All")}>
              All <span className="tab-count">{credits.length}</span>
            </button>
          )}
          {departments.map(([d, n]) => (
            <button key={d} role="tab" className="tab" aria-selected={dept === d} onClick={() => setDept(d)}>
              {d} <span className="tab-count">{n}</span>
            </button>
          ))}
        </div>
        <div className="filmo-tools">
          <label className="sr-only" htmlFor="filmo-sort">
            Sort films
          </label>
          <select id="filmo-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="view-toggle" role="group" aria-label="Layout">
            <button type="button" aria-pressed={view === "grid"} onClick={() => chooseView("grid")} title="Grid view">
              <Icon name="grid" size={18} />
              <span className="sr-only">Grid view</span>
            </button>
            <button type="button" aria-pressed={view === "list"} onClick={() => chooseView("list")} title="List view">
              <Icon name="list" size={18} />
              <span className="sr-only">List view</span>
            </button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid" role="list">
          {list.map((c, i) => (
            <div role="listitem" key={c.movie.tmdbId}>
              <MovieCard movie={liteWithMoods(c.movie)} explanation={roleLabel(c, dept) || undefined} priority={i < 6} showMoods={false} />
            </div>
          ))}
        </div>
      ) : (
        <ol className="filmo-list">
          {list.map((c) => {
            const lite = liteWithMoods(c.movie);
            const saved = !!lib.items[c.movie.tmdbId];
            const upcoming = !c.movie.releaseDate || c.movie.releaseDate > today;
            return (
              <li key={c.movie.tmdbId} className="filmo-row">
                <span className="filmo-year">{year(c.movie.releaseDate) || "TBA"}</span>
                <Link href={moviePath(c.movie)} className="filmo-thumb" tabIndex={-1} aria-hidden="true">
                  <Poster path={c.movie.posterPath} title={c.movie.title} size="w185" sizes="56px" />
                </Link>
                <div className="filmo-main">
                  <Link href={moviePath(c.movie)} className="filmo-title">
                    {c.movie.title}
                  </Link>
                  <span className="filmo-role">{roleLabel(c, dept)}</span>
                </div>
                <span className="filmo-meta">
                  {upcoming ? (
                    <span className="chip">Upcoming</span>
                  ) : (
                    <>
                      <span className="filmo-rating" title={`${c.movie.voteCount} votes on TMDB`}>
                        <Icon name="star" size={14} filled /> {rating(c.movie.voteAverage)}
                      </span>
                      <span className="filmo-lang">{lang(c.movie.originalLanguage)}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${c.movie.title} from watchlist` : `Add ${c.movie.title} to watchlist`}
                  title={saved ? "Saved" : "Add to watchlist"}
                  onClick={() => (saved ? library.remove(c.movie.tmdbId) : library.save(lite))}
                >
                  <Icon name={saved ? "check" : "plus"} size={18} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function score(m: MovieSummary) {
  const C = 6.5;
  const k = 200;
  return (m.voteCount * m.voteAverage + k * C) / (m.voteCount + k);
}
