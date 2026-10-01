"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Mood, MoodSlug } from "@/types/mood";

/** Moods come from the database (or seed) on the server and are shared with client components here. */
const MoodsContext = createContext<{ moods: Mood[]; bySlug: Map<MoodSlug, Mood> }>({ moods: [], bySlug: new Map() });

export function MoodsProvider({ moods, children }: { moods: Mood[]; children: ReactNode }) {
  const value = useMemo(() => ({ moods, bySlug: new Map(moods.map((m) => [m.slug, m])) }), [moods]);
  return <MoodsContext.Provider value={value}>{children}</MoodsContext.Provider>;
}

export const useMoods = () => useContext(MoodsContext);

/** Tints the page's "screen glow" with the colours of the active moods. */
export function useMoodGlow(slugs: MoodSlug[]) {
  const { bySlug } = useMoods();
  useEffect(() => {
    const root = document.documentElement;
    const a = slugs[0] ? bySlug.get(slugs[0])?.accent : undefined;
    const b = slugs[1] ? bySlug.get(slugs[1])?.accent : a;
    if (a) {
      root.style.setProperty("--glow-a", a);
      root.style.setProperty("--glow-b", b ?? a);
      root.style.setProperty("--glow-strength", "0.24");
    } else {
      root.style.removeProperty("--glow-a");
      root.style.removeProperty("--glow-b");
      root.style.removeProperty("--glow-strength");
    }
  }, [slugs, bySlug]);
}

/* ───────────── Theme ───────────── */

type Theme = "system" | "light" | "dark";
const THEME_KEY = "cinemood.theme";

/** Inline script (runs before paint) so the saved theme never flashes. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      /* ignore */
    }
  }, []);
  const update = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem(THEME_KEY);
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem(THEME_KEY, t);
        document.documentElement.dataset.theme = t;
      }
    } catch {
      /* ignore */
    }
  };
  return [theme, update];
}
