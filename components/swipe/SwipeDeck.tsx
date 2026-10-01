"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoodChips } from "@/components/mood/MoodChips";
import { ConfigNotice, EmptyState, ErrorState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { useMoodGlow, useMoods } from "@/components/providers/Providers";
import { deriveTaste, library, track, useLibrary, type MovieLite } from "@/lib/library/store";
import { IMG } from "@/lib/tmdb/images";
import { lang, moviePath, rating, runtime, toLite, year } from "@/lib/format";
import { LANGUAGES } from "@/lib/reference";
import type { MoodSlug } from "@/types/mood";
import type { ScoredMovie } from "@/types/recommendation";

type Verdict = "left" | "right" | "up";
type Load = "loading" | "ready" | "config" | "error" | "empty";

const THRESHOLD = 110; // px of drag needed to commit a swipe
const VERDICT_LABEL: Record<Verdict, string> = { right: "Watchlist", left: "Skip", up: "Love it" };

/**
 * Tinder-style movie deck.
 *  → right / ♥  : add to Watchlist
 *  ← left  / ✕  : skip (won't be shown again)
 *  ↑ up    / ★  : love it — Watchlist + like (strongest taste signal)
 * Keyboard: ← → ↑, Backspace to undo, Space/I to flip the card.
 */
export function SwipeDeck() {
  const { moods } = useMoods();
  const lib = useLibrary();
  const [selMoods, setSelMoods] = useState<MoodSlug[]>([]);
  const [language, setLanguage] = useState("");
  const [deck, setDeck] = useState<ScoredMovie[]>([]);
  const [status, setStatus] = useState<Load>("loading");
  const [history, setHistory] = useState<{ card: ScoredMovie; verdict: Verdict }[]>([]);
  const [flying, setFlying] = useState<{ id: number; verdict: Verdict } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [flipped, setFlipped] = useState(false);
  const page = useRef(0);
  const seen = useRef<Set<number>>(new Set());
  const loadingMore = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  useMoodGlow(selMoods);

  const fetchMore = useCallback(
    async (reset = false) => {
      if (loadingMore.current) return;
      loadingMore.current = true;
      if (reset) {
        page.current = 0;
        setStatus("loading");
      }
      const state = library.get();
      const exclude = [...new Set([...seen.current, ...Object.keys(state.items).map(Number), ...state.skips])].slice(0, 600);
      const params = new URLSearchParams();
      if (selMoods.length) params.set("moods", selMoods.map((m) => m.replace(/_/g, "-")).join(","));
      if (language) params.set("lang", language);
      try {
        // Walk deeper pages until we find unseen titles (max 3 tries per refill).
        let fresh: ScoredMovie[] = [];
        for (let tries = 0; tries < 3 && fresh.length < 6 && page.current <= 20; tries++) {
          const res = await fetch("/api/recommendations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ params: params.toString(), taste: deriveTaste(state), limit: 24, deck: page.current, exclude }),
          });
          if (res.status === 503) {
            setStatus("config");
            return;
          }
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { results: ScoredMovie[] };
          page.current += 1;
          fresh = [...fresh, ...data.results.filter((r) => !seen.current.has(r.movie.tmdbId) && !exclude.includes(r.movie.tmdbId))];
        }
        fresh.forEach((r) => seen.current.add(r.movie.tmdbId));
        setDeck((d) => (reset ? fresh : [...d, ...fresh]));
        setStatus((s) => (fresh.length || (!reset && s === "ready") ? "ready" : "empty"));
      } catch {
        setStatus("error");
      } finally {
        loadingMore.current = false;
      }
    },
    [selMoods, language],
  );

  // New filters → fresh deck.
  useEffect(() => {
    seen.current = new Set();
    void fetchMore(true);
  }, [fetchMore]);

  // Keep the deck topped up.
  useEffect(() => {
    if (status === "ready" && deck.length < 5) void fetchMore();
  }, [deck.length, status, fetchMore]);

  const top = deck[0];
  const lite = useMemo<MovieLite | null>(() => (top ? toLite(top.movie, top.profile) : null), [top]);

  const decide = useCallback(
    (verdict: Verdict) => {
      if (!top || !lite || flying) return;
      if (verdict === "right") library.save(lite, "want");
      if (verdict === "up") {
        library.save(lite, "want");
        if (library.get().reactions[lite.tmdbId] !== "like") library.react(lite, "like");
      }
      if (verdict === "left") library.skip(lite.tmdbId);
      track("recommendation_clicked", { tmdbId: lite.tmdbId, swipe: verdict });
      setFlying({ id: lite.tmdbId, verdict });
      setFlipped(false);
      window.setTimeout(() => {
        setHistory((h) => [{ card: top, verdict }, ...h].slice(0, 30));
        setDeck((d) => d.slice(1));
        setFlying(null);
        setDrag({ x: 0, y: 0, active: false });
      }, 260);
    },
    [top, lite, flying],
  );

  const undo = useCallback(() => {
    const [last, ...rest] = history;
    if (!last || flying) return;
    const id = last.card.movie.tmdbId;
    if (last.verdict === "left") library.unskip(id);
    else {
      library.remove(id);
      if (last.verdict === "up" && library.get().reactions[id] === "like") library.react(toLite(last.card.movie, last.card.profile), "like");
    }
    setHistory(rest);
    setDeck((d) => [last.card, ...d]);
  }, [history, flying]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") decide("right");
      else if (e.key === "ArrowLeft") decide("left");
      else if (e.key === "ArrowUp") decide("up");
      else if (e.key === "Backspace") undo();
      else if (e.key === " " || e.key.toLowerCase() === "i") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo]);

  /* ───────── Pointer gestures ───────── */
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    const { x, y } = drag;
    start.current = null;
    if (Math.abs(x) < 6 && Math.abs(y) < 6) {
      setDrag({ x: 0, y: 0, active: false });
      setFlipped((f) => !f); // a tap flips the card
      return;
    }
    if (y < -THRESHOLD && Math.abs(y) > Math.abs(x)) decide("up");
    else if (x > THRESHOLD) decide("right");
    else if (x < -THRESHOLD) decide("left");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const intent: Verdict | null =
    drag.y < -60 && Math.abs(drag.y) > Math.abs(drag.x) ? "up" : drag.x > 40 ? "right" : drag.x < -40 ? "left" : null;
  const strength = Math.min(1, Math.max(Math.abs(drag.x), Math.abs(drag.y)) / THRESHOLD);

  const transformFor = (i: number) => {
    if (i === 0) {
      if (flying) {
        const v = flying.verdict;
        const x = v === "right" ? 700 : v === "left" ? -700 : 0;
        const y = v === "up" ? -900 : drag.y;
        return `translate(${x}px, ${y}px) rotate(${v === "up" ? 0 : x / 20}deg)`;
      }
      return `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`;
    }
    const lift = i === 1 ? strength : 0;
    const scale = 1 - i * 0.05 + lift * 0.05;
    return `translateY(${i * 14 - lift * 14}px) scale(${scale})`;
  };

  const savedThisSession = history.filter((h) => h.verdict !== "left").length;
  const toggleMood = (slug: MoodSlug) => setSelMoods((p) => (p.includes(slug) ? p.filter((m) => m !== slug) : [...p, slug].slice(-3)));

  return (
    <div className="container swipe-page">
      <header className="swipe-head">
        <div>
          <h1>Swipe</h1>
          <p className="hide-mobile">Right for your watchlist, left to skip, up if you love it.</p>
        </div>
        <Link href="/watchlist" className="btn btn-ghost btn-sm">
          <Icon name="bookmark" size={16} /> {Object.values(lib.items).filter((i) => i.status === "want").length}
          <span className="hide-mobile">&nbsp;in watchlist</span>
        </Link>
      </header>

      <div className="swipe-filters" role="group" aria-label="Deck filters">
        <label className="sr-only" htmlFor="swipe-lang">
          Language
        </label>
        <select id="swipe-lang" className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
        {moods
          .filter((m) => m.featured)
          .map((m) => (
            <button
              key={m.slug}
              className="chip"
              aria-pressed={selMoods.includes(m.slug)}
              onClick={() => toggleMood(m.slug)}
              style={{ ["--chip" as string]: selMoods.includes(m.slug) ? m.accent : "var(--muted)", minHeight: 36, cursor: "pointer" }}
            >
              <span aria-hidden>{m.icon}</span> {m.name}
            </button>
          ))}
      </div>

      <div className="swipe-stage">
        {status === "config" && <ConfigNotice />}
        {status === "error" && <ErrorState onRetry={() => fetchMore(true)} />}
        {status === "loading" && <div className="swipe-card skeleton" aria-busy="true" aria-label="Shuffling the deck" />}
        {status !== "loading" && status !== "config" && status !== "error" && !top && (
          <EmptyState
            icon="🎬"
            title={status === "empty" ? "That's every match for now" : "Shuffling more movies…"}
            body={status === "empty" ? "Try another mood or language to deal a new deck." : undefined}
            cta={savedThisSession ? { href: "/watchlist", label: "See your watchlist" } : undefined}
          />
        )}

        {top && (
          <div className="swipe-deck" aria-live="polite">
            {deck.slice(0, 3).map((card, i) => {
              const m = card.movie;
              const poster = IMG.poster(m.posterPath, "w780");
              const isTop = i === 0;
              const topMoods = Object.entries(card.profile.scores)
                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                .slice(0, 3)
                .map(([k]) => k as MoodSlug);
              return (
                <article
                  key={m.tmdbId}
                  className={`swipe-card ${isTop ? "is-top" : ""} ${isTop && flipped ? "is-flipped" : ""}`}
                  style={{
                    zIndex: 10 - i,
                    transform: transformFor(i),
                    transition: isTop && drag.active && !flying ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1), opacity 260ms",
                    opacity: isTop && flying ? 0 : 1,
                  }}
                  aria-hidden={!isTop}
                  aria-label={isTop ? `${m.title}${m.releaseDate ? `, ${year(m.releaseDate)}` : ""}` : undefined}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? () => setDrag({ x: 0, y: 0, active: false }) : undefined}
                >
                  <div className="swipe-media">
                    {poster ? <Image src={poster} alt="" fill sizes="(max-width: 560px) 92vw, 420px" priority={i < 2} draggable={false} /> : <span className="poster-fallback">{m.title}</span>}
                  </div>
                  {isTop && (
                    <>
                      <span className="swipe-stamp stamp-right" style={{ opacity: intent === "right" ? strength : 0 }}>
                        Watchlist
                      </span>
                      <span className="swipe-stamp stamp-left" style={{ opacity: intent === "left" ? strength : 0 }}>
                        Skip
                      </span>
                      <span className="swipe-stamp stamp-up" style={{ opacity: intent === "up" ? strength : 0 }}>
                        Love it
                      </span>
                    </>
                  )}
                  <div className="swipe-info">
                    {card.labels[0] && <span className="label">{card.labels[0]}</span>}
                    <h2>{m.title}</h2>
                    <p className="swipe-meta">
                      {[year(m.releaseDate), lang(m.originalLanguage), runtime(m.runtime)].filter(Boolean).join(" · ")}
                      {m.voteAverage > 0 && (
                        <span className="rating">
                          <Icon name="star" size={14} filled /> {rating(m.voteAverage)}
                        </span>
                      )}
                    </p>
                    <div className="chip-row">
                      <MoodChips moods={topMoods} />
                    </div>
                    {isTop && flipped && (
                      <div className="swipe-more">
                        <p>{m.overview || "No synopsis available yet."}</p>
                        <p className="swipe-why">{card.explanation}</p>
                        <Link className="btn btn-ghost btn-sm" href={moviePath(m)}>
                          Full details
                        </Link>
                      </div>
                    )}
                    {isTop && !flipped && (
                      <button className="swipe-flip" onClick={() => setFlipped(true)} aria-label="Show synopsis">
                        <Icon name="plus" size={14} /> Tap for synopsis
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {top && (
        <div className="swipe-actions" role="group" aria-label="Decide">
          <button className="swipe-btn small" onClick={undo} disabled={!history.length} aria-label="Undo last swipe" title="Undo (Backspace)">
            <Icon name="arrowLeft" size={20} />
          </button>
          <button className="swipe-btn nope" onClick={() => decide("left")} aria-label={`Skip ${top.movie.title}`} title="Skip (←)">
            <Icon name="x" size={28} />
          </button>
          <button className="swipe-btn love" onClick={() => decide("up")} aria-label={`Love ${top.movie.title}`} title="Love it (↑)">
            <Icon name="star" size={24} filled />
          </button>
          <button className="swipe-btn like" onClick={() => decide("right")} aria-label={`Add ${top.movie.title} to watchlist`} title="Watchlist (→)">
            <Icon name="heart" size={28} filled />
          </button>
          <Link className="swipe-btn small" href={moviePath(top.movie)} aria-label={`Open ${top.movie.title}`} title="Details">
            <Icon name="external" size={18} />
          </Link>
        </div>
      )}

      {history.length > 0 && (
        <section className="swipe-history" aria-label="Recent swipes">
          <h2>This session</h2>
          <ul>
            {history.slice(0, 12).map(({ card, verdict }) => (
              <li key={card.movie.tmdbId} className={`v-${verdict}`}>
                <Link href={moviePath(card.movie)} title={`${card.movie.title} — ${VERDICT_LABEL[verdict]}`}>
                  {card.movie.posterPath ? (
                    <Image src={IMG.poster(card.movie.posterPath, "w185")!} alt={card.movie.title} width={56} height={84} />
                  ) : (
                    <span className="poster-fallback">{card.movie.title.slice(0, 1)}</span>
                  )}
                  <span className="verdict" aria-label={VERDICT_LABEL[verdict]}>
                    {verdict === "right" ? "♥" : verdict === "up" ? "★" : "✕"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted-note swipe-keys">Keyboard: ← skip · → watchlist · ↑ love it · Space for synopsis · Backspace to undo</p>
    </div>
  );
}
