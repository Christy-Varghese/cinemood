"use client";

import { useSyncExternalStore } from "react";
import type { MoodSlug } from "@/types/mood";
import type { TasteProfile } from "@/types/recommendation";

/**
 * The user's personal library: Watchlist, Watched, Favorites, likes/dislikes,
 * recently viewed and Surprise-Me skips.
 *
 * It lives in localStorage so anonymous users get a working watchlist instantly;
 * when signed in with Supabase, LibrarySync mirrors every change to the
 * `watchlists` table (RLS-protected) and merges server items back in.
 */

export type LibraryStatus = "want" | "watched";

export interface LibraryItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  releaseDate: string | null;
  originalLanguage: string;
  voteAverage: number;
  genreIds: number[];
  runtime?: number | null;
  moods?: MoodSlug[];
  status: LibraryStatus;
  favorite: boolean;
  /** The user's own 1–5 star rating once watched. */
  myRating?: number | null;
  addedAt: string;
  watchedAt?: string | null;
}

export type MovieLite = Omit<LibraryItem, "status" | "favorite" | "addedAt" | "watchedAt" | "myRating">;

interface LibraryState {
  items: Record<number, LibraryItem>;
  reactions: Record<number, "like" | "dislike">;
  recent: MovieLite[];
  skips: number[];
  moodHistory: Partial<Record<MoodSlug, number>>;
  /** Onboarding / "Edit preferences" picks. */
  prefs: { moods: MoodSlug[]; languages: string[]; genres: number[] };
}

const KEY = "cinemood.library.v1";
const EMPTY: LibraryState = { items: {}, reactions: {}, recent: [], skips: [], moodHistory: {}, prefs: { moods: [], languages: [], genres: [] } };

let state: LibraryState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
type Change = { kind: "upsert"; item: LibraryItem } | { kind: "remove"; tmdbId: number };
const changeListeners = new Set<(c: Change) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as LibraryState) };
  } catch {
    state = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = { ...EMPTY, ...(JSON.parse(e.newValue) as LibraryState) };
      listeners.forEach((l) => l());
    } catch {
      /* ignore */
    }
  });
}

function commit(next: LibraryState, change?: Change) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — keep in memory */
  }
  listeners.forEach((l) => l());
  if (change) changeListeners.forEach((l) => l(change));
}

export const library = {
  subscribe(l: () => void) {
    load();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get(): LibraryState {
    load();
    return state;
  },
  onChange(l: (c: Change) => void) {
    changeListeners.add(l);
    return () => changeListeners.delete(l);
  },

  save(movie: MovieLite, status: LibraryStatus = "want") {
    const prev = state.items[movie.tmdbId];
    const item: LibraryItem = {
      ...movie,
      status,
      favorite: prev?.favorite ?? false,
      myRating: prev?.myRating ?? null,
      addedAt: prev?.addedAt ?? new Date().toISOString(),
      watchedAt: status === "watched" ? (prev?.watchedAt ?? new Date().toISOString()) : null,
    };
    commit({ ...state, items: { ...state.items, [movie.tmdbId]: item } }, { kind: "upsert", item });
    track("movie_save", { tmdbId: movie.tmdbId, status });
  },
  remove(tmdbId: number) {
    const items = { ...state.items };
    delete items[tmdbId];
    commit({ ...state, items }, { kind: "remove", tmdbId });
    track("movie_remove", { tmdbId });
  },
  setStatus(tmdbId: number, status: LibraryStatus) {
    const prev = state.items[tmdbId];
    if (!prev) return;
    const item = { ...prev, status, watchedAt: status === "watched" ? new Date().toISOString() : null };
    commit({ ...state, items: { ...state.items, [tmdbId]: item } }, { kind: "upsert", item });
  },
  toggleFavorite(tmdbId: number) {
    const prev = state.items[tmdbId];
    if (!prev) return;
    const item = { ...prev, favorite: !prev.favorite };
    commit({ ...state, items: { ...state.items, [tmdbId]: item } }, { kind: "upsert", item });
  },
  rate(tmdbId: number, stars: number | null) {
    const prev = state.items[tmdbId];
    if (!prev) return;
    const item = { ...prev, myRating: stars };
    commit({ ...state, items: { ...state.items, [tmdbId]: item } }, { kind: "upsert", item });
  },
  react(movie: MovieLite, reaction: "like" | "dislike") {
    const reactions = { ...state.reactions };
    if (reactions[movie.tmdbId] === reaction) delete reactions[movie.tmdbId];
    else reactions[movie.tmdbId] = reaction;
    commit({ ...state, reactions, recent: upsertRecent(state.recent, movie) });
    track(reaction === "like" ? "movie_like" : "movie_dislike", { tmdbId: movie.tmdbId });
  },
  viewed(movie: MovieLite) {
    commit({ ...state, recent: upsertRecent(state.recent, movie) });
  },
  skip(tmdbId: number) {
    commit({ ...state, skips: [tmdbId, ...state.skips.filter((s) => s !== tmdbId)].slice(0, 200) });
    track("movie_skip", { tmdbId });
  },
  unskip(tmdbId: number) {
    commit({ ...state, skips: state.skips.filter((s) => s !== tmdbId) });
  },
  moodsSelected(moods: MoodSlug[]) {
    const moodHistory = { ...state.moodHistory };
    for (const m of moods) moodHistory[m] = (moodHistory[m] ?? 0) + 1;
    commit({ ...state, moodHistory });
  },
  setPrefs(prefs: LibraryState["prefs"]) {
    commit({ ...state, prefs });
  },
  /** Forget everything stored on this device. */
  clear() {
    commit(EMPTY);
  },
  /** Merge items from the server (signed-in users) without dropping local-only ones. */
  mergeServer(items: LibraryItem[]) {
    const merged = { ...state.items };
    for (const it of items) {
      const local = merged[it.tmdbId];
      if (!local || new Date(it.addedAt) > new Date(local.addedAt)) merged[it.tmdbId] = { ...local, ...it };
    }
    commit({ ...state, items: merged });
  },
};

const lite = (m: MovieLite): MovieLite => ({
  tmdbId: m.tmdbId,
  title: m.title,
  posterPath: m.posterPath,
  backdropPath: m.backdropPath ?? null,
  releaseDate: m.releaseDate,
  originalLanguage: m.originalLanguage,
  voteAverage: m.voteAverage,
  genreIds: m.genreIds,
  runtime: m.runtime ?? null,
  moods: m.moods ?? [],
});
const upsertRecent = (recent: MovieLite[], m: MovieLite) => [lite(m), ...recent.filter((r) => r.tmdbId !== m.tmdbId)].slice(0, 30);

export function useLibrary() {
  return useSyncExternalStore(library.subscribe, library.get, () => EMPTY);
}

/**
 * Weighted taste from interaction history. A single action never dominates:
 * saves count 1, watched 1.5, favorites 2.5, likes 1.5, dislikes −2, and
 * mood picks a gentle 0.3 each.
 */
export function deriveTaste(s: LibraryState): TasteProfile {
  const moods: Record<string, number> = {};
  const languages: Record<string, number> = {};
  const genres: Record<string, number> = {};
  const bump = (m: MovieLite, w: number) => {
    if (m.originalLanguage) languages[m.originalLanguage] = (languages[m.originalLanguage] ?? 0) + w;
    for (const g of m.genreIds ?? []) genres[g] = (genres[g] ?? 0) + w * 0.7;
    for (const md of m.moods ?? []) moods[md] = (moods[md] ?? 0) + w * 0.8;
  };
  for (const it of Object.values(s.items)) bump(it, it.favorite ? 2.5 : it.status === "watched" ? 1.5 : 1);
  for (const [id, r] of Object.entries(s.reactions)) {
    const m = s.items[Number(id)] ?? s.recent.find((x) => x.tmdbId === Number(id));
    if (m) bump(m, r === "like" ? 1.5 : -2);
  }
  for (const [m, n] of Object.entries(s.moodHistory)) moods[m] = (moods[m] ?? 0) + Math.min(5, (n ?? 0) * 0.3);
  // Stated preferences are a gentle prior that history gradually outweighs.
  for (const m of s.prefs?.moods ?? []) moods[m] = (moods[m] ?? 0) + 1;
  for (const l of s.prefs?.languages ?? []) languages[l] = (languages[l] ?? 0) + 1;
  for (const g of s.prefs?.genres ?? []) genres[g] = (genres[g] ?? 0) + 1;
  return {
    moods,
    languages,
    genres,
    negative: [
      ...Object.entries(s.reactions)
        .filter(([, r]) => r === "dislike")
        .map(([id]) => Number(id)),
      ...s.skips.slice(0, 50),
    ],
    watched: Object.values(s.items)
      .filter((i) => i.status === "watched")
      .map((i) => i.tmdbId),
  };
}

/* ───────────── Analytics events ───────────── */

export type EventType =
  | "page_view"
  | "movie_view"
  | "movie_like"
  | "movie_dislike"
  | "movie_save"
  | "movie_remove"
  | "movie_skip"
  | "search"
  | "mood_selected"
  | "language_selected"
  | "genre_selected"
  | "recommendation_generated"
  | "recommendation_clicked"
  | "surprise_me"
  | "watchlist_opened";

/** Fire-and-forget; no personal data beyond ids and filter values. */
export function track(type: EventType, metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ type, metadata });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* analytics must never break the UI */
  }
}
