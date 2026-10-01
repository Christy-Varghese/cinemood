import type { Metadata } from "next";
import { RevivalGrid } from "@/components/revival/RevivalGrid";
import { ConfigNotice, EmptyState, ErrorState } from "@/components/ui/States";
import { load } from "@/lib/load";
import { getVintageTrending, vintageReason, VINTAGE_MIN_AGE } from "@/lib/sources/buzz";

export const metadata: Metadata = {
  title: "Old is gold — classics trending again",
  description: "Older films suddenly getting attention again — the ones going viral on Reels and TikTok — tracked through Wikipedia interest spikes and TMDB trending.",
  alternates: { canonical: "/revival" },
};
export const revalidate = 21600;

export default async function RevivalPage() {
  const res = await load(getVintageTrending);
  if (!res.ok) return <div className="container">{res.reason === "config" ? <ConfigNotice /> : <ErrorState retryHref="/revival" />}</div>;
  const entries = res.data.map((v) => ({ movie: v.movie, reason: vintageReason(v), spike: v.signal.wikiSpike ?? null }));

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">🔥 Old is gold</p>
        <h1>Classics trending again</h1>
        <p>
          Films at least {VINTAGE_MIN_AGE} years old that people are suddenly talking about again, often because a clip has gone viral on Reels or TikTok.
        </p>
      </header>
      <details className="how-box">
        <summary>How we spot them</summary>
        <p>
          Instagram and TikTok don&apos;t share their trend data publicly, so we track what a viral clip leaves behind. When an old film blows up on social media, people
          look it up: its <strong>Wikipedia page views jump</strong> and it climbs <strong>TMDB&apos;s trending list</strong>. We compare each film&apos;s last three days with its
          usual daily views and show you the multiplier, for example &ldquo;↑ 4.2×&rdquo;. The list refreshes every few hours.
        </p>
      </details>
      {entries.length ? <RevivalGrid entries={entries} /> : <EmptyState icon="🎞️" title="Nothing's resurfacing right now" body="Check back in a few hours — old favourites resurface all the time." />}
    </div>
  );
}
