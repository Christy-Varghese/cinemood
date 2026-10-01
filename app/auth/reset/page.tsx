"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/db/supabase-browser";
import { ConfigNotice } from "@/components/ui/States";

export default function ResetPasswordPage() {
  const sb = supabaseBrowser();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!sb) return <div className="container"><ConfigNotice what="supabase" /></div>;
  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <header className="page-head">
        <h1>Change password</h1>
      </header>
      <form
        className="section"
        style={{ display: "grid", gap: 14, marginTop: 24 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
          const { error } = await sb.auth.updateUser({ password: pw });
          setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password updated." });
          if (!error) setPw("");
        }}
      >
        <label className="field">
          <span>New password</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {msg && <p role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "var(--ok)" : "var(--danger)", fontWeight: 600 }}>{msg.text}</p>}
        <button className="btn btn-primary">Update password</button>
      </form>
    </div>
  );
}
