"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { ConfigNotice, EmptyState, ErrorState, GridSkeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { useMoodGlow, useMoods } from "@/components/providers/Providers";
import { deriveTaste, library, track } from "@/lib/library/store";
import { queryFromParams, queryToParams } from "@/lib/search/query";
import { GENRES, LANGUAGES, genreName, languageName } from "@/lib/reference";
import { toLite } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DiscoveryQuery, ScoredMovie } from "@/types/recommendation";
import type { MoodSlug } from "@/types/mood";

const QUERY_KEYS = ["moods", "lang", "genres", "from", "to", "maxRuntime", "minRuntime", "minRating", "region", "where", "sort"];

type State = { kind: "loading" } | { kind: "error" } | { kind: "config" } | { kind: "ok"; results: ScoredMovie[]; requestId: string };

interface Props {
  /** Fixed params for SEO pages (e.g. /mood/romantic) merged under the URL params. */
  preset?: Partial<DiscoveryQuery>;
  heading?: string;
  subheading?: string;
}

export function ResultsView({ preset, heading, subheading }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { bySlug, moods } = useMoods();

  const query = useMemo(() => {
    const merged = new URLSearchParams(queryToParams(preset ?? {}));
    sp.forEach((v, k) => merged.set(k, v));
    return queryFromParams(merged);
  }, [sp, preset]);
  const paramString = queryToParams(query).toString();

  const [state, setState] = useState<State>({ kind: "loading" });
  const abort = useRef<AbortController | null>(null);
  useMoodGlow(query.moods);

  const load = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: paramString, taste: deriveTaste(library.get()), limit: 36 }),
        signal: ctrl.signal,
      });
      if (res.status === 503) return setState({ kind: "config" });
      if (!res.ok) return setState({ kind: "error" });
      const data = (await res.json()) as { results: ScoredMovie[]; requestId: string };
      setState({ kind: "ok", results: data.results, requestId: data.requestId });
      track("recommendation_generated", { moods: query.moods, languages: query.languages, count: data.results.length });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setState({ kind: "error" });
    }
  }, [paramString, query.moods, query.languages]);

  useEffect(() => {
    void load();
    return () => abort.current?.abort();
  }, [load]);

  /** Update one part of the query in the URL (preset keys stay fixed). */
  const update = (patch: Partial<DiscoveryQuery>) => {
    const next = { ...query, ...patch };
    // Keep unrelated params (e.g. the search page's ?i=1), replace the query ones.
    const p = new URLSearchParams(sp);
    for (const k of QUERY_KEYS) p.delete(k);
    queryToParams(next).forEach((v, k) => p.set(k, v));
    for (const k of Object.keys(Object.fromEntries(queryToParams(preset ?? {})))) p.delete(k);
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const presetMoods = new Set(preset?.moods ?? []);
  const removableMoods = query.moods.filter((m) => !presetMoods.has(m));
  const title =
    heading ??
    (state.kind === "ok" && query.moods.length ? t.results.match(state.results.length) : query.moods.length ? "Finding your movies…" : "Discover");

  const toggleMood = (slug: MoodSlug) => {
    const has = query.moods.includes(slug);
    update({ moods: has ? query.moods.filter((m) => m !== slug) : [...query.moods, slug].slice(-3) });
  };

  return (
    <div className="container">
      <div className="results-head">
        <div>
          <h1>{title}</h1>
          {subheading && <p style={{ color: "var(--text-2)", marginTop: 10 }}>{subheading}</p>}
          {query.moods.length > 0 && (
            <div className="chip-row" style={{ marginTop: 14 }}>
              {query.moods.map((slug) => {
                const m = bySlug.get(slug);
                if (!m) return null;
                return (
                  <span key={slug} className="chip" style={{ ["--chip" as string]: m.accent, minHeight: 34, fontSize: "0.9rem" }}>
                    <span aria-hidden>{m.icon}</span> {m.name}
                    {removableMoods.includes(slug) && (
                      <button aria-label={`Remove ${m.name}`} onClick={() => toggleMood(slug)}>
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="filter-bar" role="toolbar" aria-label="Filters">
        <label className="sr-only" htmlFor="f-mood">
          Add a mood
        </label>
        <select
          id="f-mood"
          className="select"
          value=""
          onChange={(e) => e.target.value && toggleMood(e.target.value as MoodSlug)}
          disabled={query.moods.length >= 3}
        >
          <option value="">{query.moods.length >= 3 ? "3 moods max" : "+ Mood"}</option>
          {moods
            .filter((m) => !query.moods.includes(m.slug))
            .map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.icon} {m.name}
              </option>
            ))}
        </select>
        <label className="sr-only" htmlFor="f-lang">
          {t.filters.language}
        </label>
        <select
          id="f-lang"
          className={`select ${query.languages.length ? "is-set" : ""}`}
          value={query.languages[0] ?? ""}
          onChange={(e) => update({ languages: e.target.value ? [e.target.value] : [] })}
          disabled={!!preset?.languages?.length}
        >
          <option value="">{t.filters.anyLanguage}</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-genre">
          {t.filters.genre}
        </label>
        <select
          id="f-genre"
          className={`select ${query.genres.length ? "is-set" : ""}`}
          value={query.genres[0] ?? ""}
          onChange={(e) => update({ genres: e.target.value ? [Number(e.target.value)] : [] })}
          disabled={!!preset?.genres?.length}
        >
          <option value="">{t.filters.anyGenre}</option>
          {GENRES.filter((g) => g.id !== 10770).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-runtime">
          {t.filters.runtime}
        </label>
        <select
          id="f-runtime"
          className={`select ${query.maxRuntime ? "is-set" : ""}`}
          value={query.maxRuntime ?? ""}
          onChange={(e) => update({ maxRuntime: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{t.filters.anyRuntime}</option>
          <option value="100">Under 1h 40m</option>
          <option value="120">Under 2 hours</option>
          <option value="150">Under 2h 30m</option>
        </select>
        <label className="sr-only" htmlFor="f-rating">
          {t.filters.rating}
        </label>
        <select
          id="f-rating"
          className={`select ${query.minRating ? "is-set" : ""}`}
          value={query.minRating ?? ""}
          onChange={(e) => update({ minRating: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{t.filters.anyRating}</option>
          <option value="6">Rated 6+</option>
          <option value="7">Rated 7+</option>
          <option value="8">Rated 8+</option>
        </select>
        <label className="sr-only" htmlFor="f-era">
          {t.filters.era}
        </label>
        <select
          id="f-era"
          className={`select ${query.minYear || query.maxYear ? "is-set" : ""}`}
          value={`${query.minYear ?? ""}-${query.maxYear ?? ""}`}
          onChange={(e) => {
            const [a, b] = e.target.value.split("-");
            update({ minYear: a ? Number(a) : null, maxYear: b ? Number(b) : null });
          }}
        >
          <option value="-">{t.filters.anyEra}</option>
          <option value="2020-">2020s</option>
          <option value="2010-2019">2010s</option>
          <option value="2000-2009">2000s</option>
          <option value="1990-1999">1990s</option>
          <option value="-1989">Before 1990</option>
        </select>
        <label className="sr-only" htmlFor="f-where">
          {t.filters.where}
        </label>
        <select
          id="f-where"
          className={`select ${query.availability !== "any" ? "is-set" : ""}`}
          value={query.availability}
          onChange={(e) => update({ availability: e.target.value as DiscoveryQuery["availability"] })}
        >
          <option value="any">{t.filters.anyWhere}</option>
          <option value="stream">{t.filters.stream}</option>
          <option value="rent">{t.filters.rent}</option>
          <option value="buy">{t.filters.buy}</option>
        </select>
        <label className="sr-only" htmlFor="f-sort">
          {t.filters.sort}
        </label>
        <select id="f-sort" className="select" value={query.sort} onChange={(e) => update({ sort: e.target.value as DiscoveryQuery["sort"] })}>
          <option value="recommended">Sort: {t.results.sortRecommended}</option>
          <option value="rating">Sort: {t.results.sortRating}</option>
          <option value="popularity">Sort: {t.results.sortPopularity}</option>
          <option value="newest">Sort: {t.results.sortNewest}</option>
        </select>
      </div>

      <ActiveFilters query={query} preset={preset} onChange={update} />

      {state.kind === "loading" && <GridSkeleton count={12} />}
      {state.kind === "config" && <ConfigNotice />}
      {state.kind === "error" && <ErrorState onRetry={load} />}
      {state.kind === "ok" && state.results.length === 0 && <EmptyState icon="🔭" title={t.results.none} body={t.results.noneHint} />}
      {state.kind === "ok" && state.results.length > 0 && (
        <div className="grid" role="list" aria-live="polite">
          {state.results.map((r, i) => (
            <div role="listitem" key={r.movie.tmdbId}>
              <MovieCard
                movie={toLite(r.movie, r.profile)}
                explanation={r.explanation}
                labels={r.labels}
                position={i + 1}
                requestId={state.requestId}
                hrefSuffix={query.moods.length ? `?moods=${query.moods.map((m) => m.replace(/_/g, "-")).join(",")}` : ""}
                priority={i < 6}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveFilters({ query, preset, onChange }: { query: DiscoveryQuery; preset?: Partial<DiscoveryQuery>; onChange: (p: Partial<DiscoveryQuery>) => void }) {
  const chips: { label: string; clear: Partial<DiscoveryQuery> }[] = [];
  if (query.languages.length && !preset?.languages?.length) chips.push({ label: query.languages.map(languageName).join(", "), clear: { languages: [] } });
  if (query.genres.length && !preset?.genres?.length) chips.push({ label: query.genres.map(genreName).join(", "), clear: { genres: [] } });
  if (query.maxRuntime) chips.push({ label: `Under ${query.maxRuntime} min`, clear: { maxRuntime: null } });
  if (query.minRuntime) chips.push({ label: `Over ${query.minRuntime} min`, clear: { minRuntime: null } });
  if (query.minRating) chips.push({ label: `Rated ${query.minRating}+`, clear: { minRating: null } });
  if (query.minYear || query.maxYear) chips.push({ label: `${query.minYear ?? "…"}–${query.maxYear ?? "now"}`, clear: { minYear: null, maxYear: null } });
  if (query.availability !== "any") chips.push({ label: { stream: "Streaming", rent: "Rent", buy: "Buy" }[query.availability], clear: { availability: "any" } });
  if (!chips.length) return null;
  return (
    <div className="active-filters" style={{ marginTop: -12, marginBottom: 24 }}>
      {chips.map((c) => (
        <span className="chip" key={c.label} style={{ minHeight: 32 }}>
          {c.label}
          <button aria-label={`Remove filter ${c.label}`} onClick={() => onChange(c.clear)}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      <button
        className="link-btn"
        onClick={() => onChange({ languages: preset?.languages ?? [], genres: preset?.genres ?? [], maxRuntime: null, minRuntime: null, minRating: null, minYear: null, maxYear: null, availability: "any" })}
      >
        {t.filters.clear}
      </button>
    </div>
  );
}
