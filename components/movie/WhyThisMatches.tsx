"use client";

import { useSearchParams } from "next/navigation";
import { useMoods } from "@/components/providers/Providers";
import { queryFromParams } from "@/lib/search/query";
import { deriveTaste, useLibrary } from "@/lib/library/store";
import { explain, moodMatch } from "@/lib/recommendations/engine";
import type { MovieSummary } from "@/types/movie";
import type { MoodProfile, MoodSlug } from "@/types/mood";

/**
 * "Why this matches your mood" — uses the moods the user arrived with
 * (?moods=… on the URL) or, failing that, their most-picked moods.
 * Built only from scores and metadata.
 */
export function WhyThisMatches({ movie, profile }: { movie: MovieSummary; profile: MoodProfile }) {
  const sp = useSearchParams();
  const lib = useLibrary();
  const { bySlug } = useMoods();
  let moods = queryFromParams(sp).moods;
  let fromHistory = false;
  if (!moods.length) {
    moods = (Object.entries(lib.moodHistory) as [MoodSlug, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([m]) => m);
    fromHistory = moods.length > 0;
  }
  if (!moods.length) return null;

  const match = moodMatch(profile, moods);
  const names = moods.map((m) => bySlug.get(m)?.name.toLowerCase() ?? m);
  const lead = fromHistory ? `You often look for something ${names.join(" and ")}.` : `You asked for something ${names.join(" and ")}.`;
  const verdict = match >= 0.7 ? "This is a strong match" : match >= 0.45 ? "This is a partial match" : "This is a loose match";

  return (
    <section className="section" aria-labelledby="why">
      <h2 id="why" style={{ marginBottom: 14 }}>
        Why this matches your mood
      </h2>
      <div className="why-box">
        <p>
          <strong>{lead}</strong> {verdict} ({Math.round(match * 100)}%). {explain(movie, profile, moods, deriveTaste(lib))}
        </p>
      </div>
    </section>
  );
}
