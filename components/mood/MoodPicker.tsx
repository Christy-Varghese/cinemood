"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMoodGlow, useMoods } from "@/components/providers/Providers";
import { Icon } from "@/components/ui/Icon";
import { library, track } from "@/lib/library/store";
import { queryToParams } from "@/lib/search/query";
import { GENRES, LANGUAGES } from "@/lib/reference";
import { t } from "@/lib/i18n";
import type { Mood, MoodSlug } from "@/types/mood";
import type { AvailabilityFilter, DiscoveryQuery } from "@/types/recommendation";

const ERAS = [
  { v: "", label: t.filters.anyEra },
  { v: "2020-", label: "2020s" },
  { v: "2010-2019", label: "2010s" },
  { v: "2000-2009", label: "2000s" },
  { v: "1990-1999", label: "1990s" },
  { v: "-1989", label: "Before 1990" },
];
const RUNTIMES = [
  { v: "", label: t.filters.anyRuntime },
  { v: "100", label: "Under 1h 40m" },
  { v: "120", label: "Under 2 hours" },
  { v: "150", label: "Under 2h 30m" },
];
const RATINGS = [
  { v: "", label: t.filters.anyRating },
  { v: "6", label: "6+" },
  { v: "7", label: "7+" },
  { v: "8", label: "8+" },
];
const EXAMPLES = ["Something funny and relaxing", "A dark Korean thriller", "An emotional Malayalam movie", "Blow my mind, under 2 hours"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t.home.eyebrowMorning : h < 18 ? t.home.eyebrowAfternoon : t.home.eyebrowEvening;
}

export function MoodPicker() {
  const router = useRouter();
  const { moods } = useMoods();
  const [selected, setSelected] = useState<MoodSlug[]>([]);
  const [language, setLanguage] = useState("");
  const [genre, setGenre] = useState("");
  const [era, setEra] = useState("");
  const [maxRuntime, setMaxRuntime] = useState("");
  const [minRating, setMinRating] = useState("");
  const [where, setWhere] = useState<AvailabilityFilter>("any");
  const [ask, setAsk] = useState("");
  const [hello, setHello] = useState<string | null>(null);

  useEffect(() => setHello(greeting()), []);
  useMoodGlow(selected);

  const featured = useMemo(() => moods.filter((m) => m.featured), [moods]);
  const more = useMemo(() => moods.filter((m) => !m.featured), [moods]);

  const toggle = (slug: MoodSlug) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      track("mood_selected", { mood: slug });
      // Max three: the oldest pick makes room for the newest.
      return prev.length >= 3 ? [...prev.slice(1), slug] : [...prev, slug];
    });
  };

  const buildQuery = (): Partial<DiscoveryQuery> => {
    const [from, to] = era.split("-");
    return {
      moods: selected,
      languages: language ? [language] : [],
      genres: genre ? [Number(genre)] : [],
      minYear: from ? Number(from) : null,
      maxYear: to ? Number(to) : null,
      maxRuntime: maxRuntime ? Number(maxRuntime) : null,
      minRating: minRating ? Number(minRating) : null,
      availability: where,
    };
  };

  const find = () => {
    if (!selected.length) return;
    library.moodsSelected(selected);
    if (language) track("language_selected", { language });
    router.push(`/discover?${queryToParams(buildQuery()).toString()}`);
  };

  const surprise = () => {
    track("surprise_me", { moods: selected });
    router.push(`/surprise?${queryToParams(buildQuery()).toString()}`);
  };

  const tile = (m: Mood) => {
    const on = selected.includes(m.slug);
    return (
      <button
        key={m.slug}
        type="button"
        className="mood-tile"
        aria-pressed={on}
        onClick={() => toggle(m.slug)}
        style={{ ["--accent" as string]: m.accent }}
        title={m.description}
      >
        {on && (
          <span className="check" aria-hidden>
            {selected.indexOf(m.slug) + 1}
          </span>
        )}
        <span className="emoji" aria-hidden>
          {m.icon}
        </span>
        {m.name}
      </button>
    );
  };

  return (
    <section className="hero container" aria-labelledby="hero-title">
      <p className="hero-greeting" aria-live="polite">
        {hello ? `${hello} 👋` : " "}
      </p>
      <h1 id="hero-title">{t.home.title}</h1>
      <p className="hero-sub">{t.home.subtitle}</p>

      <div className="mood-grid" role="group" aria-label="Moods — choose up to three">
        {featured.map(tile)}
      </div>
      {more.length > 0 && (
        <details className="more-moods">
          <summary>
            <Icon name="plus" size={16} /> {t.home.moreMoods}
          </summary>
          <div className="mood-grid" role="group" aria-label="More moods">
            {more.map(tile)}
          </div>
        </details>
      )}

      <p className="hero-hint" aria-live="polite">
        {selected.length === 0 ? t.home.pickHint : selected.length === 3 ? t.home.maxMoods : ""}
      </p>

      {selected.length > 0 && (
        <div className="refine" aria-label={t.home.refine}>
          <label className="field">
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
          <label className="field">
            <span>{t.filters.genre}</span>
            <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">{t.filters.anyGenre}</option>
              {GENRES.filter((g) => g.id !== 10770).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.filters.era}</span>
            <select className="select" value={era} onChange={(e) => setEra(e.target.value)}>
              {ERAS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.filters.runtime}</span>
            <select className="select" value={maxRuntime} onChange={(e) => setMaxRuntime(e.target.value)}>
              {RUNTIMES.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.filters.rating}</span>
            <select className="select" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              {RATINGS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.filters.where}</span>
            <select className="select" value={where} onChange={(e) => setWhere(e.target.value as AvailabilityFilter)}>
              <option value="any">{t.filters.anyWhere}</option>
              <option value="stream">{t.filters.stream}</option>
              <option value="rent">{t.filters.rent}</option>
              <option value="buy">{t.filters.buy}</option>
            </select>
          </label>
        </div>
      )}

      <div className="hero-actions">
        <button className="btn btn-primary btn-lg" onClick={find} disabled={!selected.length}>
          {t.home.find}
        </button>
        <span className="or">{t.home.or}</span>
        <button className="btn btn-outline btn-lg" onClick={surprise}>
          <span aria-hidden>🎲</span> {t.home.surprise}
        </button>
      </div>

      <div className="ask">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) router.push(`/search?q=${encodeURIComponent(ask.trim())}`);
          }}
        >
          <label htmlFor="ask" className="sr-only">
            {t.home.askPlaceholder}
          </label>
          <span className="ask-icon">
            <Icon name="sparkle" />
          </span>
          <input id="ask" className="input" placeholder={t.home.askPlaceholder} value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={200} autoComplete="off" />
          <button className="btn btn-ghost" type="submit">
            Ask
          </button>
        </form>
        <div className="ask-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => router.push(`/search?q=${encodeURIComponent(ex)}`)}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
