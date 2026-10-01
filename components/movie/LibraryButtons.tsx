"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { library, track, useLibrary, type MovieLite } from "@/lib/library/store";
import { t } from "@/lib/i18n";

/** Watchlist / Watched / Favorite / Like controls on the detail page. */
export function LibraryButtons({ movie }: { movie: MovieLite }) {
  const lib = useLibrary();
  const item = lib.items[movie.tmdbId];
  const reaction = lib.reactions[movie.tmdbId];
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    library.viewed(movie);
    track("movie_view", { tmdbId: movie.tmdbId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie.tmdbId]);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="detail-actions">
      <button
        className={`btn ${item?.status === "want" ? "btn-ghost is-on" : "btn-primary"}`}
        aria-pressed={item?.status === "want"}
        onClick={() => {
          if (item?.status === "want") {
            library.remove(movie.tmdbId);
            flash("Removed from watchlist");
          } else {
            library.save(movie, "want");
            flash("Added to watchlist");
          }
        }}
      >
        <Icon name={item?.status === "want" ? "check" : "plus"} size={18} />
        {item?.status === "want" ? t.movie.inWatchlist : t.movie.addWatchlist}
      </button>
      <button
        className={`btn btn-ghost ${item?.status === "watched" ? "is-on" : ""}`}
        aria-pressed={item?.status === "watched"}
        onClick={() => {
          if (item?.status === "watched") {
            library.setStatus(movie.tmdbId, "want");
            flash("Moved back to watchlist");
          } else {
            library.save(movie, "watched");
            flash("Marked as watched");
          }
        }}
      >
        <Icon name="eye" size={18} />
        {item?.status === "watched" ? t.movie.watched : t.movie.markWatched}
      </button>
      <button
        className={`btn btn-ghost ${item?.favorite ? "is-on" : ""}`}
        aria-pressed={!!item?.favorite}
        aria-label={item?.favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={() => {
          if (!item) library.save(movie, "watched");
          library.toggleFavorite(movie.tmdbId);
        }}
      >
        <Icon name="heart" size={18} filled={!!item?.favorite} />
        <span className="hide-mobile">{t.movie.favorite}</span>
      </button>
      <button className={`btn btn-ghost ${reaction === "like" ? "is-on" : ""}`} aria-pressed={reaction === "like"} aria-label={t.movie.like} onClick={() => library.react(movie, "like")}>
        <Icon name="thumbUp" size={18} />
      </button>
      <button className={`btn btn-ghost ${reaction === "dislike" ? "is-on" : ""}`} aria-pressed={reaction === "dislike"} aria-label={t.movie.dislike} onClick={() => library.react(movie, "dislike")}>
        <Icon name="thumbDown" size={18} />
      </button>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
