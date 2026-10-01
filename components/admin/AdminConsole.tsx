"use client";

import { useState } from "react";
import { DEFAULT_WEIGHTS, validateWeights } from "@/lib/recommendations/engine";
import type { RecommendationWeights } from "@/types/recommendation";
import type { Mood } from "@/types/mood";

const LABELS: Record<keyof RecommendationWeights, string> = {
  mood: "Mood match",
  language: "Language match",
  preference: "User preference",
  genre: "Genre match",
  rating: "Rating quality",
  popularity: "Popularity",
  freshness: "Freshness",
  diversity: "Diversity",
};

async function post(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AdminConsole({ weights, flags, moods, role }: { weights: RecommendationWeights; flags: Record<string, boolean>; moods: Mood[]; role: string }) {
  const [w, setW] = useState(weights);
  const [note, setNote] = useState("");
  const [f, setF] = useState(flags);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncKind, setSyncKind] = useState("popular");
  const [syncLang, setSyncLang] = useState("ml");
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(false);
  const [movieId, setMovieId] = useState("");
  const [manual, setManual] = useState<Record<string, number>>({});
  const total = validateWeights(w).total;
  const canAdmin = role === "admin" || role === "super_admin";

  const run = async (label: string, fn: () => Promise<{ ok: boolean; data: Record<string, unknown> }>) => {
    setBusy(true);
    setMsg(`${label}…`);
    const { ok, data } = await fn();
    setBusy(false);
    setMsg(ok ? `${label}: done ${JSON.stringify(data)}` : `${label} failed: ${String(data.error ?? "error")}`);
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && (
        <div className="notice" role="status">
          {msg}
        </div>
      )}

      <section className="panel" aria-labelledby="weights">
        <h2 id="weights">Recommendation weights</h2>
        <div className="weights">
          {(Object.keys(LABELS) as (keyof RecommendationWeights)[]).map((k) => (
            <label className="weight-row" key={k}>
              <span>{LABELS[k]}</span>
              <input type="range" min={0} max={60} step={1} value={Math.round(w[k] * 100)} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) / 100 })} disabled={!canAdmin} />
              <strong style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(w[k] * 100)}%</strong>
            </label>
          ))}
        </div>
        <p style={{ marginTop: 14, fontWeight: 700, color: Math.abs(total - 1) < 0.001 ? "var(--ok)" : "var(--danger)" }}>
          Total {Math.round(total * 100)}% {Math.abs(total - 1) < 0.001 ? "✓" : "— must equal 100%"}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Version note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary" disabled={!canAdmin || busy || Math.abs(total - 1) >= 0.001} onClick={() => run("Saved new config version", () => post("/api/admin/config", { weights: w, note }))}>
            Save as new version
          </button>
          <button className="btn btn-ghost" onClick={() => setW(DEFAULT_WEIGHTS)}>
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="flags">
        <h2 id="flags">Feature flags</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {Object.entries(f).map(([k, v]) => (
            <label key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={v} disabled={!canAdmin} onChange={(e) => setF({ ...f, [k]: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--marquee)" }} />
              <code>{k}</code>
            </label>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 14 }} disabled={!canAdmin || busy} onClick={() => run("Saved flags", () => post("/api/admin/config", { flags: f }))}>
          Save flags
        </button>
      </section>

      <section className="panel" aria-labelledby="sync">
        <h2 id="sync">Movie synchronization</h2>
        <p className="muted-note" style={{ marginBottom: 14 }}>
          Imports from TMDB into Postgres (idempotent on <code>tmdb_id</code>) and generates mood profiles for new movies only.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label className="field">
            <span>Source</span>
            <select className="select" value={syncKind} onChange={(e) => setSyncKind(e.target.value)}>
              <option value="popular">Popular</option>
              <option value="now_playing">Now playing</option>
              <option value="upcoming">Upcoming</option>
              <option value="top_rated">Top rated</option>
              <option value="trending">Trending</option>
              <option value="language">By language</option>
            </select>
          </label>
          {syncKind === "language" && (
            <label className="field">
              <span>Language code</span>
              <input className="input" value={syncLang} onChange={(e) => setSyncLang(e.target.value)} maxLength={2} style={{ width: 90 }} />
            </label>
          )}
          <label className="field">
            <span>Pages (20 movies each)</span>
            <input className="input" type="number" min={1} max={10} value={pages} onChange={(e) => setPages(Number(e.target.value))} style={{ width: 120 }} />
          </label>
          <button className="btn btn-primary" disabled={!canAdmin || busy} onClick={() => run("Sync", () => post("/api/admin/sync", { kind: syncKind, pages, language: syncKind === "language" ? syncLang : undefined }))}>
            Run sync
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => run("Mood classification", () => post("/api/admin/mood-generation", { limit: 20 }))}>
            Classify pending moods
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="edit">
        <h2 id="edit">Manual mood adjustment</h2>
        <p className="muted-note" style={{ marginBottom: 14 }}>
          Scores you set here are stored with source <code>manual</code> and are never overwritten by automatic runs.
        </p>
        <label className="field" style={{ maxWidth: 240 }}>
          <span>TMDB id</span>
          <input className="input" inputMode="numeric" value={movieId} onChange={(e) => setMovieId(e.target.value.replace(/\D/g, ""))} />
        </label>
        <div className="weights" style={{ marginTop: 14 }}>
          {moods.map((m) => (
            <label className="weight-row" key={m.slug}>
              <span>
                {m.icon} {m.name}
              </span>
              <input type="range" min={0} max={100} value={Math.round((manual[m.slug] ?? 0) * 100)} onChange={(e) => setManual({ ...manual, [m.slug]: Number(e.target.value) / 100 })} />
              <strong style={{ textAlign: "right" }}>{manual[m.slug] !== undefined ? `${Math.round(manual[m.slug] * 100)}%` : "—"}</strong>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            disabled={!movieId || !Object.keys(manual).length || busy}
            onClick={() => run("Saved mood adjustment", () => post(`/api/admin/movies/${movieId}`, { moods: manual }, "PATCH"))}
          >
            Save moods
          </button>
          <button className="btn btn-ghost" disabled={!movieId || busy} onClick={() => run("Regenerated", () => post("/api/admin/mood-generation", { tmdbIds: [Number(movieId)] }))}>
            Regenerate with AI
          </button>
          <button className="btn btn-ghost" disabled={!movieId || busy} onClick={() => run("Hidden", () => post(`/api/admin/movies/${movieId}`, { is_hidden: true }, "PATCH"))}>
            Hide movie
          </button>
          <button className="btn btn-ghost" disabled={!movieId || busy} onClick={() => run("Featured", () => post(`/api/admin/movies/${movieId}`, { is_featured: true }, "PATCH"))}>
            Feature movie
          </button>
        </div>
      </section>
    </div>
  );
}
