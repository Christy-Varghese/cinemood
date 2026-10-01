"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/db/supabase-browser";
import { ConfigNotice } from "@/components/ui/States";

type Mode = "signin" | "signup" | "magic";

const OAUTH = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s): s is "google" | "apple" => s === "google" || s === "apple");

export function AuthForm() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(sp.get("error") ? { kind: "err", text: "That sign-in link didn't work. Request a new one." } : null);

  if (!sb) return <ConfigNotice what="supabase" />;

  const redirectTo = `${window.location.origin}/auth/callback?next=/profile?welcome=1`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ kind: "err", text: "Enter a valid email address." });
    if (mode !== "magic" && password.length < 8) return setMsg({ kind: "err", text: "Passwords need at least 8 characters." });
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setMsg({ kind: "ok", text: `Check ${email} for a sign-in link.` });
      } else if (mode === "signup") {
        const { error, data } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session) router.push("/profile?welcome=1");
        else setMsg({ kind: "ok", text: `Confirm your email — we sent a link to ${email}.` });
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/profile");
        router.refresh();
      }
    } catch (err) {
      // Supabase messages are user-safe (e.g. "Invalid login credentials").
      setMsg({ kind: "err", text: (err as Error).message || "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div className="tabs" role="tablist" aria-label="Sign-in method" style={{ marginBottom: 22 }}>
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
            ["magic", "Email link"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button key={m} role="tab" className="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={msg?.kind === "err" && !email ? true : undefined} />
        </label>
        {mode !== "magic" && (
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {msg && (
          <p role={msg.kind === "err" ? "alert" : "status"} style={{ color: msg.kind === "err" ? "var(--danger)" : "var(--ok)", fontWeight: 600 }}>
            {msg.text}
          </p>
        )}
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "One moment…" : mode === "signup" ? "Create account" : mode === "magic" ? "Email me a link" : "Sign in"}
        </button>
      </form>
      {OAUTH.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
          {OAUTH.map((p) => (
            <button key={p} className="btn btn-outline" onClick={() => sb.auth.signInWithOAuth({ provider: p, options: { redirectTo } })}>
              Continue with {p === "google" ? "Google" : "Apple"}
            </button>
          ))}
        </div>
      )}
      <p className="muted-note" style={{ marginTop: 22 }}>
        You don&apos;t need an account to discover movies. Signing in syncs your watchlist and watched history across devices.
      </p>
    </div>
  );
}
