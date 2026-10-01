"use client";

import { useEffect } from "react";
import { library } from "@/lib/library/store";
import { supabaseBrowser } from "@/lib/db/supabase-browser";

/**
 * Mirrors the local library to Supabase for signed-in users.
 * Guests keep everything on-device; signing in merges the two.
 */
export function LibrarySync() {
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let signedIn = false;

    const pull = async () => {
      const res = await fetch("/api/watchlist", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const data = (await res.json()) as { items: Parameters<typeof library.mergeServer>[0]; signedIn: boolean };
      signedIn = data.signedIn;
      if (!signedIn) return;
      library.mergeServer(data.items);
      // Push local-only items up once after sign-in.
      const serverIds = new Set(data.items.map((i) => i.tmdbId));
      for (const it of Object.values(library.get().items)) {
        if (!serverIds.has(it.tmdbId)) void push(it);
      }
    };
    const push = (item: unknown) =>
      fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }).catch(() => null);

    void pull();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void pull();
      if (event === "SIGNED_OUT") signedIn = false;
    });
    const off = library.onChange((c) => {
      if (!signedIn) return;
      if (c.kind === "upsert") void push(c.item);
      else void fetch(`/api/watchlist/${c.tmdbId}`, { method: "DELETE" }).catch(() => null);
    });
    return () => {
      sub.subscription.unsubscribe();
      off();
    };
  }, []);
  return null;
}
