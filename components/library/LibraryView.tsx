"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { useMoods } from "@/components/providers/Providers";
import { library, track, useLibrary, type LibraryItem } from "@/lib/library/store";
import { languageName } from "@/lib/reference";
import { t } from "@/lib/i18n";

export type LibraryTab = "watchlist" | "watched" | "favorites" | "all";

const TABS: { key: LibraryTab; href: string; label: string }[] = [
  { key: "watchlist", href: "/watchlist", label: t.library.watchlistTitle },
  { key: "watched", href: "/watched", label: t.library.watchedTitle },
  { key: "favorites", href: "/favorites", label: t.library.favoritesTitle },
  { key: "all", href: "/watchlist?view=all", label: t.library.all },
];

type Sort = "added" | "title" | "rating" | "year" | "mine";

function Stars({ value, onChange, title }: { value: number | null | undefined; onChange: (n: number | null) => void; title: string }) {
  return (
    <span className="stars" role="radiogroup" aria-label={`${t.library.rateIt}: ${title}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={value && n <= value ? "on" : ""}
          onClick={() => onChange(value === n ? null : n)}
        >
          <Icon name="star" size={18} filled={!!value && n <= value} />
        </button>
      ))}
    </span>
  );
}

export function LibraryView({ tab }: { tab: LibraryTab }) {
  const lib = useLibrary();
  const { bySlug } = useMoods();
  const [sort, setSort] = useState<Sort>(tab === "watched" ? "added" : "added");
  const [langFilter, setLangFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    track("watchlist_opened", { tab });
  }, [tab]);

  const all = Object.values(lib.items);
  const counts = {
    watchlist: all.filter((i) => i.status === "want").length,
    watched: all.filter((i) => i.status === "watched").length,
    favorites: all.filter((i) => i.favorite).length,
    all: all.length,
  };

  const inTab = useMemo(() => {
    const base = all.filter((i) => (tab === "watchlist" ? i.status === "want" : tab === "watched" ? i.status === "watched" : tab === "favorites" ? i.favorite : true));
    const filtered = base.filter((i) => (!langFilter || i.originalLanguage === langFilter) && (!moodFilter || i.moods?.includes(moodFilter as never)));
    const by: Record<Sort, (a: LibraryItem, b: LibraryItem) => number> = {
      added: (a, b) => (b.watchedAt ?? b.addedAt).localeCompare(a.watchedAt ?? a.addedAt),
      title: (a, b) => a.title.localeCompare(b.title),
      rating: (a, b) => b.voteAverage - a.voteAverage,
      year: (a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
      mine: (a, b) => (b.myRating ?? 0) - (a.myRating ?? 0),
    };
    return filtered.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.items, tab, sort, langFilter, moodFilter]);

  const languages = [...new Set(all.map((i) => i.originalLanguage).filter(Boolean))];
  const moodsInLib = [...new Set(all.flatMap((i) => i.moods ?? []))];

  const watched = all.filter((i) => i.status === "watched");
  const hours = Math.round(watched.reduce((a, i) => a + (i.runtime ?? 0), 0) / 60);
  const langCount = new Set(watched.map((i) => i.originalLanguage)).size;

  const empty =
    tab === "watched"
      ? { icon: "🍿", title: t.library.emptyWatched, body: t.library.emptyWatchedHint }
      : tab === "favorites"
        ? { icon: "💛", title: t.library.emptyFavorites, body: t.library.emptyFavoritesHint }
        : { icon: "🎬", title: t.library.emptyWatchlist, body: t.library.emptyWatchlistHint };

  return (
    <div className="container">
      <header className="page-head">
        <h1>{tab === "watched" ? t.library.watchedTitle : tab === "favorites" ? t.library.favoritesTitle : t.library.watchlistTitle}</h1>
        {tab === "watched" && hydrated && watched.length > 0 && (
          <div className="lib-stats">
            <div className="lib-stat">
              <strong>{watched.length}</strong>
              <span>movies watched</span>
            </div>
            <div className="lib-stat">
              <strong>{hours}h</strong>
              <span>of cinema</span>
            </div>
            <div className="lib-stat">
              <strong>{langCount}</strong>
              <span>{langCount === 1 ? "language" : "languages"}</span>
            </div>
          </div>
        )}
      </header>

      <nav className="tabs" aria-label="Library sections" style={{ marginTop: 24 }}>
        {TABS.map((tb) => (
          <Link key={tb.key} className="tab" href={tb.href} aria-current={tb.key === tab ? "page" : undefined}>
            {tb.label}
            {hydrated && <span className="count">{counts[tb.key]}</span>}
          </Link>
        ))}
      </nav>

      {hydrated && inTab.length + (langFilter || moodFilter ? 1 : 0) > 0 && (
        <div className="library-toolbar">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="sr-only" htmlFor="lib-lang">
              Filter by language
            </label>
            <select id="lib-lang" className="select" value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="lib-mood">
              Filter by mood
            </label>
            <select id="lib-mood" className="select" value={moodFilter} onChange={(e) => setMoodFilter(e.target.value)}>
              <option value="">All moods</option>
              {moodsInLib.map((m) => (
                <option key={m} value={m}>
                  {bySlug.get(m)?.icon} {bySlug.get(m)?.name ?? m}
                </option>
              ))}
            </select>
          </div>
          <label className="sr-only" htmlFor="lib-sort">
            Sort
          </label>
          <select id="lib-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="added">{tab === "watched" ? "Recently watched" : t.library.sortAdded}</option>
            <option value="title">{t.library.sortTitle}</option>
            <option value="rating">TMDB {t.library.sortRating.toLowerCase()}</option>
            <option value="year">{t.library.sortYear}</option>
            {tab !== "watchlist" && <option value="mine">My rating</option>}
          </select>
        </div>
      )}

      {!hydrated ? null : inTab.length === 0 ? (
        langFilter || moodFilter ? (
          <EmptyState icon="🔎" title="Nothing matches those filters" body="Clear a filter to see more of your library." />
        ) : (
          <EmptyState {...empty} cta={{ href: "/", label: t.library.discover }} />
        )
      ) : (
        <div className="grid" role="list">
          {inTab.map((item) => (
            <div role="listitem" key={item.tmdbId}>
              <MovieCard movie={item} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
                {item.status === "want" ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => library.setStatus(item.tmdbId, "watched")}>
                    <Icon name="eye" size={16} /> Watched
                  </button>
                ) : (
                  <Stars value={item.myRating} title={item.title} onChange={(n) => library.rate(item.tmdbId, n)} />
                )}
                <button
                  className={`icon-btn ${item.favorite ? "" : ""}`}
                  style={{ width: 36, height: 36, color: item.favorite ? "var(--danger)" : undefined }}
                  aria-pressed={item.favorite}
                  aria-label={item.favorite ? `Unfavorite ${item.title}` : `Favorite ${item.title}`}
                  onClick={() => library.toggleFavorite(item.tmdbId)}
                >
                  <Icon name="heart" size={18} filled={item.favorite} />
                </button>
                <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`${t.library.remove} ${item.title}`} title={t.library.remove} onClick={() => library.remove(item.tmdbId)}>
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hydrated && all.length > 0 && <LocalNote />}
    </div>
  );
}

function LocalNote() {
  const [cloud, setCloud] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d: { signedIn: boolean }) => setCloud(d.signedIn))
      .catch(() => setCloud(false));
  }, []);
  if (cloud !== false) return null;
  return (
    <div className="notice section">
      <Icon name="bookmark" />
      <span>{t.library.localNote}</span>
      <Link className="link-btn" href="/auth">
        Sign in
      </Link>
    </div>
  );
}
