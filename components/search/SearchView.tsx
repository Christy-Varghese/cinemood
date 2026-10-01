"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ResultsView } from "@/components/discover/ResultsView";
import { MovieCard } from "@/components/movie/MovieCard";
import { ConfigNotice, EmptyState, ErrorState, GridSkeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { useMoods } from "@/components/providers/Providers";
import { track } from "@/lib/library/store";
import { queryFromParams } from "@/lib/search/query";
import { genreName, languageName } from "@/lib/reference";
import { toLite } from "@/lib/format";
import { ruleBasedProfile } from "@/lib/mood-engine/rules";
import { t } from "@/lib/i18n";
import type { MovieSummary } from "@/types/movie";

type Mode = "natural" | "classic";
interface Classic {
  titles: MovieSummary[];
  person: { name: string; department: string } | null;
  personMovies: MovieSummary[];
  keyword: string | null;
  keywordMovies: MovieSummary[];
}
type State = { kind: "idle" } | { kind: "loading" } | { kind: "config" } | { kind: "error" } | { kind: "classic"; data: Classic } | { kind: "interpreted" };

const EXAMPLES = [
  "I want something funny and romantic",
  "Give me a dark Korean thriller",
  "An emotional Malayalam movie",
  "Something relaxing for a Sunday evening",
  "A movie that will blow my mind",
  "An uplifting movie under two hours",
];

const lite = (m: MovieSummary) => toLite(m, ruleBasedProfile({ genreIds: m.genreIds, overview: m.overview }));

export function SearchView() {
  const router = useRouter();
  const sp = useSearchParams();
  const { bySlug } = useMoods();
  const initialQ = sp.get("q") ?? "";
  const interpreted = sp.get("i") === "1";
  const [mode, setMode] = useState<Mode>((sp.get("mode") as Mode) === "classic" ? "classic" : "natural");
  const [text, setText] = useState(initialQ);
  const [state, setState] = useState<State>(interpreted ? { kind: "interpreted" } : { kind: "idle" });
  const [source, setSource] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = async (q: string, m: Mode) => {
    if (!q.trim()) return setState({ kind: "idle" });
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ kind: "loading" });
    track("search", { mode: m, q: q.trim().toLowerCase().slice(0, 100) });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, mode: m }),
        signal: ctrl.signal,
      });
      if (res.status === 503) return setState({ kind: "config" });
      if (!res.ok) return setState({ kind: "error" });
      const data = await res.json();
      if (data.kind === "interpreted") {
        setSource(data.source);
        router.replace(`/search?${data.params}&q=${encodeURIComponent(q)}&i=1`, { scroll: false });
        setState({ kind: "interpreted" });
      } else {
        setState({ kind: "classic", data });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setState({ kind: "error" });
    }
  };

  // Run an incoming ?q= once (from the home page "Ask" box), unless it's already interpreted.
  useEffect(() => {
    if (initialQ && !interpreted) void run(initialQ, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Classic mode searches as you type (debounced + cancellable).
  useEffect(() => {
    if (mode !== "classic") return;
    const id = window.setTimeout(() => {
      if (text.trim().length >= 2) void run(text, "classic");
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mode]);

  const q = queryFromParams(sp);

  return (
    <div>
      <div className="container">
        <header className="page-head">
          <h1>{t.search.title}</h1>
        </header>
        <div className="tabs" role="tablist" aria-label="Search mode" style={{ marginTop: 22 }}>
          <button role="tab" className="tab" aria-selected={mode === "natural"} onClick={() => setMode("natural")}>
            <Icon name="sparkle" size={16} /> {t.search.modeNatural}
          </button>
          <button role="tab" className="tab" aria-selected={mode === "classic"} onClick={() => setMode("classic")}>
            <Icon name="search" size={16} /> {t.search.modeClassic}
          </button>
        </div>
        <form
          role="search"
          className="ask"
          style={{ margin: "18px 0 0", maxWidth: 760 }}
          onSubmit={(e) => {
            e.preventDefault();
            void run(text, mode);
          }}
        >
          <div style={{ position: "relative" }}>
            <label htmlFor="q" className="sr-only">
              {t.search.placeholder}
            </label>
            <span className="ask-icon">
              <Icon name={mode === "natural" ? "sparkle" : "search"} />
            </span>
            <input
              id="q"
              className="input"
              autoFocus
              autoComplete="off"
              maxLength={200}
              placeholder={mode === "natural" ? t.search.placeholder : "Inception, Fahadh Faasil, time loop…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </div>
        </form>

        {state.kind === "idle" && mode === "natural" && (
          <div className="section" style={{ marginTop: 28 }}>
            <p className="muted-note" style={{ marginBottom: 10 }}>
              {t.search.examples}
            </p>
            <div className="chip-row">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="chip"
                  style={{ minHeight: 38, cursor: "pointer", fontSize: "0.9rem" }}
                  onClick={() => {
                    setText(ex);
                    void run(ex, "natural");
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.kind === "interpreted" && (
          <div className="notice" style={{ marginTop: 22 }} aria-live="polite">
            <strong>{t.search.understood}:</strong>
            {q.moods.map((m) => (
              <span key={m} className="chip" style={{ ["--chip" as string]: bySlug.get(m)?.accent }}>
                {bySlug.get(m)?.icon} {bySlug.get(m)?.name}
              </span>
            ))}
            {q.languages.map((l) => (
              <span key={l} className="chip">
                {languageName(l)}
              </span>
            ))}
            {q.genres.map((g) => (
              <span key={g} className="chip">
                {genreName(g)}
              </span>
            ))}
            {q.maxRuntime && <span className="chip">Under {q.maxRuntime} min</span>}
            {q.minRating && <span className="chip">Rated {q.minRating}+</span>}
            {(q.minYear || q.maxYear) && (
              <span className="chip">
                {q.minYear ?? "…"}–{q.maxYear ?? "now"}
              </span>
            )}
            {source && <span className="muted-note">({source === "ai" ? "interpreted by local AI" : "interpreted by rules"})</span>}
          </div>
        )}
      </div>

      {/* Mount results only once the interpreted filters are in the URL (avoids a wasted unfiltered fetch). */}
      {state.kind === "interpreted" && interpreted && <ResultsView heading={`“${initialQ || text}”`} />}

      <div className="container">
        {state.kind === "loading" && (
          <div className="section">
            <GridSkeleton count={8} />
          </div>
        )}
        {state.kind === "config" && <ConfigNotice />}
        {state.kind === "error" && <ErrorState onRetry={() => run(text, mode)} />}
        {state.kind === "classic" && <ClassicResults data={state.data} />}
      </div>
    </div>
  );
}

function ClassicResults({ data }: { data: Classic }) {
  const empty = !data.titles.length && !data.personMovies.length && !data.keywordMovies.length;
  if (empty) return <EmptyState icon="🔍" title="No matches" body="Check the spelling, or describe a mood instead — “something cosy and funny”." />;
  const block = (title: string, list: MovieSummary[]) =>
    list.length > 0 && (
      <section className="section" aria-label={title}>
        <div className="section-head">
          <h2>{title}</h2>
        </div>
        <div className="grid" role="list">
          {list.map((m) => (
            <div role="listitem" key={m.tmdbId}>
              <MovieCard movie={lite(m)} />
            </div>
          ))}
        </div>
      </section>
    );
  return (
    <>
      {block(t.search.titles, data.titles)}
      {data.person && block(`${data.person.department === "Directing" ? "Directed by" : "Starring"} ${data.person.name}`, data.personMovies)}
      {data.keyword && block(`${t.search.keywords} “${data.keyword}”`, data.keywordMovies)}
    </>
  );
}
