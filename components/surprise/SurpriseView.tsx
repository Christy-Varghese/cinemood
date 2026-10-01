"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Poster } from "@/components/movie/Poster";
import { MoodChips } from "@/components/mood/MoodChips";
import { ConfigNotice, EmptyState, ErrorState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { useMoodGlow, useMoods } from "@/components/providers/Providers";
import { deriveTaste, library, track } from "@/lib/library/store";
import { queryFromParams, queryToParams } from "@/lib/search/query";
import { LANGUAGES } from "@/lib/reference";
import { lang, moviePath, rating, runtime, toLite, year } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { MoodSlug } from "@/types/mood";
import type { ScoredMovie } from "@/types/recommendation";

interface Pick {
  pick: ScoredMovie | null;
  detail: { tagline: string | null; directors: string[]; trailer: { key: string } | null; cast: string[] } | null;
}
type State = { kind: "idle" } | { kind: "loading" } | { kind: "config" } | { kind: "error" } | { kind: "none" } | { kind: "ok"; data: Pick };

export function SurpriseView() {
  const sp = useSearchParams();
  const initial = queryFromParams(sp);
  const { moods } = useMoods();
  const [selMoods, setSelMoods] = useState<MoodSlug[]>(initial.moods);
  const [language, setLanguage] = useState(initial.languages[0] ?? "");
  const [maxRuntime, setMaxRuntime] = useState(initial.maxRuntime ? String(initial.maxRuntime) : "");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [saved, setSaved] = useState(false);
  const shown = useRef<number[]>([]);
  useMoodGlow(selMoods);

  const spin = async () => {
    setState({ kind: "loading" });
    setSaved(false);
    track("surprise_me", { moods: selMoods });
    const lib = library.get();
    const exclude = [...new Set([...lib.skips.slice(0, 100), ...shown.current, ...Object.keys(lib.items).map(Number)])].slice(0, 300);
    const params = queryToParams({ ...initial, moods: selMoods, languages: language ? [language] : [], maxRuntime: maxRuntime ? Number(maxRuntime) : null }).toString();
    try {
      const res = await fetch("/api/surprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, exclude, taste: deriveTaste(lib) }),
      });
      if (res.status === 503) return setState({ kind: "config" });
      if (!res.ok) return setState({ kind: "error" });
      const data = (await res.json()) as Pick;
      if (!data.pick) return setState({ kind: "none" });
      shown.current.push(data.pick.movie.tmdbId);
      setState({ kind: "ok", data });
    } catch {
      setState({ kind: "error" });
    }
  };

  // If the user arrived from the home page with moods, spin straight away.
  useEffect(() => {
    if (initial.moods.length || sp.toString()) void spin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (slug: MoodSlug) => setSelMoods((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug].slice(-3)));

  return (
    <div className="container">
      <header className="page-head">
        <h1>
          <span aria-hidden>🎲</span> {t.surprise.title}
        </h1>
        <p>{t.surprise.subtitle}</p>
      </header>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="chip-row" role="group" aria-label="Optional moods">
          {moods
            .filter((m) => m.featured)
            .map((m) => (
              <button
                key={m.slug}
                className="chip"
                aria-pressed={selMoods.includes(m.slug)}
                onClick={() => toggle(m.slug)}
                style={{
                  ["--chip" as string]: selMoods.includes(m.slug) ? m.accent : "var(--muted)",
                  minHeight: 38,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                <span aria-hidden>{m.icon}</span> {m.name}
              </button>
            ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "end" }}>
          <label className="field" style={{ minWidth: 180 }}>
            <span>{t.filters.language}</span>
            <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">{t.filters.anyLanguage}</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span>{t.filters.runtime}</span>
            <select className="select" value={maxRuntime} onChange={(e) => setMaxRuntime(e.target.value)}>
              <option value="">{t.filters.anyRuntime}</option>
              <option value="100">Under 1h 40m</option>
              <option value="120">Under 2 hours</option>
            </select>
          </label>
          <button className="btn btn-primary btn-lg" onClick={spin} disabled={state.kind === "loading"}>
            <Icon name="dice" /> {state.kind === "ok" ? "Spin again" : t.surprise.spin}
          </button>
        </div>
      </div>

      {state.kind === "loading" && (
        <div className="surprise-stage" aria-busy="true">
          <div className="skeleton surprise-poster" />
          <div>
            <div className="skeleton sk-line" style={{ height: 40, width: "60%" }} />
            <div className="skeleton sk-line" style={{ width: "40%" }} />
            <div className="skeleton sk-line" style={{ width: "80%", marginTop: 24 }} />
          </div>
        </div>
      )}
      {state.kind === "config" && <ConfigNotice />}
      {state.kind === "error" && <ErrorState onRetry={spin} />}
      {state.kind === "none" && <EmptyState icon="🫙" title="You've seen everything in this mood" body="Try another mood or language — we skip films you've saved, watched or passed on." />}
      {state.kind === "ok" && state.data.pick && <Reveal data={state.data} saved={saved} onSkip={() => {
        library.skip(state.data.pick!.movie.tmdbId);
        void spin();
      }} onAccept={() => {
        library.save(toLite(state.data.pick!.movie, state.data.pick!.profile));
        setSaved(true);
      }} />}
    </div>
  );
}

function Reveal({ data, saved, onSkip, onAccept }: { data: Pick; saved: boolean; onSkip: () => void; onAccept: () => void }) {
  const { movie, profile, explanation } = data.pick!;
  const top = Object.entries(profile.scores)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([m]) => m as MoodSlug);
  return (
    <section className="surprise-stage" key={movie.tmdbId} aria-live="polite">
      <Link href={moviePath(movie)} className="surprise-poster" aria-label={`Open ${movie.title}`}>
        <Poster path={movie.posterPath} title={movie.title} size="w500" priority sizes="320px" />
      </Link>
      <div className="surprise-body">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <MoodChips moods={top} />
        </div>
        <h2>{movie.title}</h2>
        <div className="detail-meta">
          {movie.voteAverage > 0 && (
            <span className="rating">
              <Icon name="star" size={16} filled /> {rating(movie.voteAverage)}
            </span>
          )}
          {[year(movie.releaseDate), lang(movie.originalLanguage), runtime(movie.runtime)].filter(Boolean).map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        {data.detail?.tagline && <p className="detail-tagline">{data.detail.tagline}</p>}
        <p className="prose" style={{ marginTop: 16 }}>
          {movie.overview}
        </p>
        {(data.detail?.directors.length || data.detail?.cast.length) ? (
          <p className="muted-note" style={{ marginTop: 12 }}>
            {data.detail.directors.length > 0 && <>Directed by {data.detail.directors.join(", ")}. </>}
            {data.detail.cast.length > 0 && <>With {data.detail.cast.join(", ")}.</>}
          </p>
        ) : null}
        <div className="why-box" style={{ marginTop: 18 }}>
          <p>{explanation}</p>
        </div>
        <div className="detail-actions">
          <button className="btn btn-outline" onClick={onSkip}>
            {t.surprise.skip}
          </button>
          {saved ? (
            <Link className="btn btn-primary" href={moviePath(movie)}>
              <Icon name="check" size={18} /> Saved — view details
            </Link>
          ) : (
            <button className="btn btn-primary" onClick={onAccept}>
              {t.surprise.accept}
            </button>
          )}
          {data.detail?.trailer && (
            <a className="btn btn-ghost" href={`https://www.youtube.com/watch?v=${data.detail.trailer.key}`} target="_blank" rel="noreferrer">
              <Icon name="play" size={16} filled /> Trailer
            </a>
          )}
        </div>
        {saved && (
          <p className="muted-note" role="status" style={{ marginTop: 10 }}>
            {t.surprise.saved}.
          </p>
        )}
      </div>
    </section>
  );
}
