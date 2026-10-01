import type { Mood, MoodProfile, MoodSlug } from "@/types/mood";

/** Mood DNA: the movie's full weighted profile as bars, strongest first. */
export function MoodDNA({ profile, moods, max = 7 }: { profile: MoodProfile; moods: Mood[]; max?: number }) {
  const bySlug = new Map(moods.map((m) => [m.slug, m]));
  const rows = Object.entries(profile.scores)
    .map(([slug, score]) => ({ mood: bySlug.get(slug as MoodSlug), score: score ?? 0 }))
    .filter((r): r is { mood: Mood; score: number } => !!r.mood && r.score >= 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  if (!rows.length) return <p className="muted-note">Not enough information to profile this movie&apos;s mood yet.</p>;

  const sourceLabel = { ai: "local AI classifier", rules: "genre and keyword analysis", manual: "editor review", database: "the CineMood mood engine" }[profile.source];

  return (
    <div>
      <div className="dna" role="list" aria-label="Mood profile">
        {rows.map(({ mood, score }, i) => (
          <div className="dna-row" role="listitem" key={mood.slug} aria-label={`${mood.name}: ${Math.round(score * 100)} percent`}>
            <span className="name">
              <span aria-hidden>{mood.icon}</span>
              {mood.name}
            </span>
            <span className="dna-bar" aria-hidden>
              <span style={{ width: `${Math.round(score * 100)}%`, ["--accent" as string]: mood.accent, animationDelay: `${i * 70}ms` }} />
            </span>
            <span className="pct">{Math.round(score * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="dna-foot">
        Profile from {sourceLabel} · confidence {Math.round(profile.confidence * 100)}%
      </p>
    </div>
  );
}
