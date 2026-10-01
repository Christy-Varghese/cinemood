"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Review } from "@/types/movie";

function avatarSrc(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return null; // external gravatar — skip to avoid third-party requests
  return `https://image.tmdb.org/t/p/w92${path}`;
}

function ReviewCard({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  const long = r.content.length > 600;
  const src = avatarSrc(r.avatarPath);
  return (
    <article className="review">
      <header className="review-head">
        <span className="review-avatar" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" loading="lazy" /> : r.author.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <div className="review-author">{r.author}</div>
          <div className="review-date">{timeAgo(r.createdAt)}</div>
        </div>
        {r.rating !== null && (
          <span className="review-score" aria-label={`Rated ${r.rating} out of 10 by ${r.author}`}>
            <Icon name="star" size={14} filled /> {r.rating}/10
          </span>
        )}
      </header>
      <p className={`review-body ${long && !open ? "clamped" : ""}`}>{r.content}</p>
      <footer className="review-foot">
        {long && (
          <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? t.movie.readLess : t.movie.readMore}
          </button>
        )}
        <a href={r.url} target="_blank" rel="noreferrer">
          View on TMDB
        </a>
      </footer>
    </article>
  );
}

/** TMDB user reviews with author attribution and paging. */
export function ReviewList({ tmdbId, initial, total }: { tmdbId: number; initial: Review[]; total: number }) {
  const [reviews, setReviews] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!reviews.length) return <p className="muted-note">{t.movie.noReviews}</p>;

  const rated = reviews.filter((r) => r.rating !== null);
  const avg = rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null;

  const more = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/movies/${tmdbId}/reviews?page=${page + 1}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { results: Review[] };
      setReviews((prev) => [...prev, ...data.results.filter((r) => !prev.some((p) => p.id === r.id))]);
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="review-summary">
        <span>
          {total} review{total === 1 ? "" : "s"} from the TMDB community
        </span>
        {avg !== null && (
          <span className="review-score" title="Average of reviewers who left a score">
            <Icon name="star" size={14} filled /> {avg.toFixed(1)} reviewer avg
          </span>
        )}
      </div>
      <div className="reviews">
        {reviews.map((r) => (
          <ReviewCard key={r.id} r={r} />
        ))}
      </div>
      {reviews.length < total && (
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-outline" onClick={more} disabled={loading}>
            {loading ? "Loading…" : t.movie.moreReviews}
          </button>
          {failed && (
            <p className="muted-note" role="alert" style={{ marginTop: 8 }}>
              Couldn&apos;t load more reviews. Try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
