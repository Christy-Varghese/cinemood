"use client";

import { useMoods } from "@/components/providers/Providers";
import type { MoodSlug } from "@/types/mood";

export function MoodChips({ moods, max = 3 }: { moods: MoodSlug[]; max?: number }) {
  const { bySlug } = useMoods();
  return (
    <>
      {moods.slice(0, max).map((slug) => {
        const m = bySlug.get(slug);
        if (!m) return null;
        return (
          <span key={slug} className="chip" style={{ ["--chip" as string]: m.accent }}>
            <span aria-hidden>{m.icon}</span>
            {m.name}
          </span>
        );
      })}
    </>
  );
}
