"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MovieCard } from "@/components/movie/MovieCard";
import { useMoods, useTheme } from "@/components/providers/Providers";
import { deriveTaste, library, useLibrary } from "@/lib/library/store";
import { supabaseBrowser } from "@/lib/db/supabase-browser";
import { GENRES, LANGUAGES, genreName, languageName } from "@/lib/reference";
import { t } from "@/lib/i18n";
import type { MoodSlug } from "@/types/mood";

const top = (rec: Record<string, number>, n = 5) =>
  Object.entries(rec)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);

export function ProfileView() {
  const lib = useLibrary();
  const sp = useSearchParams();
  const router = useRouter();
  const { moods, bySlug } = useMoods();
  const [theme, setTheme] = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [editing, setEditing] = useState(sp.get("welcome") === "1");
  const [hydrated, setHydrated] = useState(false);
  const sb = supabaseBrowser();

  useEffect(() => {
    setHydrated(true);
    sb?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [sb]);

  const taste = deriveTaste(lib);
  const topMoods = top(taste.moods as Record<string, number>) as MoodSlug[];
  const topLangs = top(taste.languages);
  const topGenres = top(taste.genres).map(Number);
  const liked = lib.recent.filter((m) => lib.reactions[m.tmdbId] === "like" || lib.items[m.tmdbId]?.favorite);
  const disliked = lib.recent.filter((m) => lib.reactions[m.tmdbId] === "dislike");

  const togglePref = <K extends keyof typeof lib.prefs>(key: K, value: (typeof lib.prefs)[K][number]) => {
    const list = lib.prefs[key] as (typeof value)[];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    library.setPrefs({ ...lib.prefs, [key]: next });
  };

  if (!hydrated) return null;

  return (
    <div className="container">
      <header className="page-head">
        <h1>{email ? "Your profile" : "Your movie taste"}</h1>
        <p>{email ? `Signed in as ${email}` : "Everything here is learned from what you save, watch and like on this device."}</p>
      </header>

      <section className="section" aria-labelledby="taste">
        <div className="section-head">
          <h2 id="taste">Your movie taste</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(!editing)} aria-expanded={editing}>
            {editing ? "Done" : "Edit preferences"}
          </button>
        </div>

        {editing ? (
          <div className="panel" style={{ display: "grid", gap: 22 }}>
            <p style={{ color: "var(--text-2)" }}>
              <strong>What do you usually watch?</strong> Choose as many as you want — or skip. Your history will matter more over time.
            </p>
            <div>
              <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Moods</h3>
              <div className="chip-row">
                {moods.map((m) => (
                  <button
                    key={m.slug}
                    className="chip"
                    aria-pressed={lib.prefs.moods.includes(m.slug)}
                    style={{ ["--chip" as string]: lib.prefs.moods.includes(m.slug) ? m.accent : "var(--muted)", minHeight: 36, cursor: "pointer" }}
                    onClick={() => togglePref("moods", m.slug)}
                  >
                    {m.icon} {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Languages</h3>
              <div className="chip-row">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    className="chip"
                    aria-pressed={lib.prefs.languages.includes(l.code)}
                    style={{ ["--chip" as string]: lib.prefs.languages.includes(l.code) ? "var(--marquee)" : "var(--muted)", minHeight: 36, cursor: "pointer" }}
                    onClick={() => togglePref("languages", l.code)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Genres</h3>
              <div className="chip-row">
                {GENRES.filter((g) => g.id !== 10770).map((g) => (
                  <button
                    key={g.id}
                    className="chip"
                    aria-pressed={lib.prefs.genres.includes(g.id)}
                    style={{ ["--chip" as string]: lib.prefs.genres.includes(g.id) ? "var(--marquee)" : "var(--muted)", minHeight: 36, cursor: "pointer" }}
                    onClick={() => togglePref("genres", g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={() => { setEditing(false); router.push("/"); }}>
                Find my movie
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                Skip for now
              </button>
            </div>
          </div>
        ) : topMoods.length + topLangs.length + topGenres.length === 0 ? (
          <div className="notice">
            <span aria-hidden>🌱</span>
            <span>
              <strong>{t.empty.learning}</strong> {t.empty.learningHint}
            </span>
          </div>
        ) : (
          <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="panel">
              <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Favorite moods</h3>
              <div className="chip-row">
                {topMoods.map((m) => (
                  <span key={m} className="chip" style={{ ["--chip" as string]: bySlug.get(m)?.accent }}>
                    {bySlug.get(m)?.icon} {bySlug.get(m)?.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Favorite languages</h3>
              <div className="chip-row">
                {topLangs.map((l) => (
                  <span key={l} className="chip">
                    {languageName(l)}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Favorite genres</h3>
              <div className="chip-row">
                {topGenres.map((g) => (
                  <span key={g} className="chip">
                    {genreName(g)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="lib-links">
        <div className="tabs" id="lib-links">
          <Link className="tab" href="/watchlist">
            Watchlist <span className="count">{Object.values(lib.items).filter((i) => i.status === "want").length}</span>
          </Link>
          <Link className="tab" href="/watched">
            Watched <span className="count">{Object.values(lib.items).filter((i) => i.status === "watched").length}</span>
          </Link>
          <Link className="tab" href="/favorites">
            Favorites <span className="count">{Object.values(lib.items).filter((i) => i.favorite).length}</span>
          </Link>
        </div>
      </section>

      {[
        ["Recently viewed", lib.recent.slice(0, 16)],
        ["Liked", liked],
        ["Not for me", disliked],
      ].map(([title, list]) =>
        (list as typeof lib.recent).length ? (
          <section className="section" key={title as string}>
            <div className="section-head">
              <h2>{title as string}</h2>
            </div>
            <div className="rail" role="list">
              {(list as typeof lib.recent).map((m) => (
                <div role="listitem" key={m.tmdbId}>
                  <MovieCard movie={m} />
                </div>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section className="section" aria-labelledby="settings">
        <h2 id="settings" style={{ marginBottom: 16 }}>
          Settings
        </h2>
        <div className="panel" style={{ display: "grid", gap: 18 }}>
          <label className="field" style={{ maxWidth: 320 }}>
            <span>Theme</span>
            <select className="select" value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
              <option value="system">Match my device</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <div>
            <h3 style={{ fontSize: "1rem", marginBottom: 6 }}>Privacy</h3>
            <p className="muted-note">
              CineMood records anonymous interaction events (movie ids and the filters you use) to improve recommendations. No viewing data is sold or shared.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {email ? (
              <>
                <Link className="btn btn-ghost" href="/auth/reset">
                  Change password
                </Link>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await sb?.auth.signOut();
                    setEmail(null);
                    router.refresh();
                  }}
                >
                  Sign out
                </button>
                <DeleteAccount />
              </>
            ) : (
              <Link className="btn btn-primary" href="/auth">
                Sign in to sync
              </Link>
            )}
            <button
              className="btn btn-outline"
              onClick={() => {
                if (window.confirm("Clear your watchlist, watched history and preferences from this device?")) library.clear();
              }}
            >
              Clear data on this device
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeleteAccount() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-outline"
      style={{ color: "var(--danger)", borderColor: "color-mix(in oklab, var(--danger) 50%, transparent)" }}
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Permanently delete your CineMood account and synced watchlist? This can't be undone.")) return;
        setBusy(true);
        const res = await fetch("/api/account", { method: "DELETE" });
        setBusy(false);
        if (res.ok) {
          await supabaseBrowser()?.auth.signOut();
          library.clear();
          window.location.href = "/";
        } else window.alert("We couldn't delete your account right now. Try again later.");
      }}
    >
      Delete account
    </button>
  );
}
