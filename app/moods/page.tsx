import Link from "next/link";
import type { Metadata } from "next";
import { getMoods } from "@/lib/db/repository";
import { moodToUrl } from "@/lib/moods/taxonomy";

export const metadata: Metadata = {
  title: "Explore by mood",
  description: "Twenty moods, from comforting to mind-bending. Pick how you feel and find the movie.",
  alternates: { canonical: "/moods" },
};

export default async function MoodsPage() {
  const moods = await getMoods();
  return (
    <div className="container">
      <header className="page-head">
        <h1>Explore by mood</h1>
        <p>Every movie in CineMood carries a weighted mood profile, so a mood page can surface a tense drama as easily as a thriller.</p>
      </header>
      <div className="explore-moods section" style={{ marginTop: 32 }}>
        {moods.map((m) => (
          <Link key={m.slug} href={`/mood/${moodToUrl(m.slug)}`} className="mood-card" style={{ ["--accent" as string]: m.accent, minHeight: 156 }}>
            <span className="emoji" aria-hidden>
              {m.icon}
            </span>
            <strong>{m.name}</strong>
            <span>{m.tagline}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
