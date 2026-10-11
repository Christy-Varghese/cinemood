import type { Metadata } from "next";
import { Suspense } from "react";
import { SeasonBlock } from "@/components/season/SeasonSpotlight";
import { GenrePulse } from "@/components/season/GenrePulse";
import { RailSkeleton } from "@/components/ui/States";
import { seasonNext, seasonsNow } from "@/lib/trends/service";

export const metadata: Metadata = {
  title: "In season — movies for right now",
  description: "What to watch this time of year — spooky season, holidays, Valentine's, summer blockbusters — plus the genres trending this week.",
  alternates: { canonical: "/season" },
};
export const revalidate = 3600;

const fmt = (d: Date) => d.toLocaleDateString("en", { month: "long", day: "numeric", timeZone: "UTC" });

export default function SeasonPage() {
  const seasons = seasonsNow();
  const next = seasonNext();
  const skeleton = (
    <div className="section">
      <RailSkeleton />
    </div>
  );
  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">In season</p>
        <h1>Movies for right now</h1>
        <p>CineMood changes what it features with the calendar and with what people are watching this week. Nothing here is hand-picked; it updates by itself.</p>
      </header>

      <Suspense fallback={skeleton}>
        <GenrePulse />
      </Suspense>

      {seasons.map((s, i) => (
        <div key={s.slug} id={s.slug} className="section" style={{ scrollMarginTop: 90 }}>
          <Suspense fallback={skeleton}>
            <SeasonBlock season={s} priority={i === 0} />
          </Suspense>
        </div>
      ))}

      {next && (
        <aside className="season-next" style={{ ["--season" as string]: next.season.accent }}>
          <span aria-hidden>{next.season.emoji}</span>
          <div>
            <p className="season-why">Coming up · from {fmt(next.starts)}</p>
            <strong>{next.season.name}</strong>
            <p>{next.season.tagline}</p>
          </div>
        </aside>
      )}
    </div>
  );
}
