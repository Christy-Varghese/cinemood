"use client";

import Link from "next/link";
import { useState } from "react";
import { Poster } from "./Poster";
import { MoodChips } from "@/components/mood/MoodChips";
import { Icon } from "@/components/ui/Icon";
import { library, track, useLibrary, type MovieLite } from "@/lib/library/store";
import { lang, moviePath, rating, runtime, year } from "@/lib/format";
import type { ResultLabel } from "@/types/recommendation";

interface Props {
  movie: MovieLite;
  /** Shown under the title on results pages. */
  explanation?: string;
  labels?: ResultLabel[];
  position?: number;
  requestId?: string;
  priority?: boolean;
  showMoods?: boolean;
  /** Carries context to the detail page, e.g. "?moods=romantic". */
  hrefSuffix?: string;
}

/**
 * Poster-first card. Quick actions appear on hover (desktop) and are always
 * visible on touch devices. Mood tags, not genres, are the primary descriptor.
 */
export function MovieCard({ movie, explanation, labels, position, requestId, priority, showMoods = true, hrefSuffix = "" }: Props) {
  const lib = useLibrary();
  const item = lib.items[movie.tmdbId];
  const reaction = lib.reactions[movie.tmdbId];
  const [toast, setToast] = useState<string | null>(null);
  const href = moviePath(movie) + hrefSuffix;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const meta = [year(movie.releaseDate), lang(movie.originalLanguage), runtime(movie.runtime)].filter(Boolean);

  return (
    <article className="card">
      <Link
        href={href}
        className="card-poster"
        onClick={() => position !== undefined && track("recommendation_clicked", { tmdbId: movie.tmdbId, position, requestId: requestId ?? null })}
        aria-label={`${movie.title}${meta[0] ? ` (${meta[0]})` : ""}`}
      >
        <Poster path={movie.posterPath} title={movie.title} priority={priority} />
        {item?.status === "watched" && <span className="card-badge">Watched</span>}
      </Link>

      <div className="card-actions">
        <button
          type="button"
          aria-pressed={!!item}
          aria-label={item ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
          title={item ? "Saved" : "Add to watchlist"}
          onClick={() => {
            if (item) {
              library.remove(movie.tmdbId);
              flash("Removed");
            } else {
              library.save(movie);
              flash("Added to watchlist");
            }
          }}
        >
          <Icon name={item ? "check" : "plus"} size={18} />
        </button>
        <button
          type="button"
          className="hover-only"
          aria-pressed={reaction === "like"}
          aria-label={`Like ${movie.title}`}
          title="Like"
          onClick={() => library.react(movie, "like")}
        >
          <Icon name="thumbUp" size={17} />
        </button>
        <button
          type="button"
          className="hover-only"
          aria-pressed={reaction === "dislike"}
          aria-label={`Not for me: ${movie.title}`}
          title="Not for me"
          onClick={() => library.react(movie, "dislike")}
        >
          <Icon name="thumbDown" size={17} />
        </button>
      </div>

      <div className="card-body">
        {labels && labels.length > 0 && (
          <div className="card-labels">
            {labels.slice(0, 2).map((l) => (
              <span key={l} className="label">
                {l}
              </span>
            ))}
          </div>
        )}
        <h3 className="card-title" style={{ font: "inherit", fontWeight: 750, letterSpacing: 0 }}>
          <Link href={href}>{movie.title}</Link>
        </h3>
        <div className="card-meta">
          {meta.join(" · ")}
        </div>
        {showMoods && movie.moods && movie.moods.length > 0 && (
          <div className="card-moods">
            <MoodChips moods={movie.moods} max={2} />
          </div>
        )}
        {movie.voteAverage > 0 && (
          <span className="rating" aria-label={`Rated ${rating(movie.voteAverage)} out of 10 on TMDB`}>
            <Icon name="star" size={14} filled /> {rating(movie.voteAverage)}
          </span>
        )}
        {explanation && <p className="card-why">{explanation}</p>}
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </article>
  );
}
