import Link from "next/link";
import { getGenrePulse } from "@/lib/trends/service";
import { GENRES } from "@/lib/reference";
import { logError } from "@/lib/logger";

/** "Heating up this week" — genres over-represented in this week's trending vs normal. */
export async function GenrePulse({ title = "Genres heating up this week" }: { title?: string }) {
  let pulse: Awaited<ReturnType<typeof getGenrePulse>> = [];
  try {
    pulse = await getGenrePulse();
  } catch (e) {
    logError("tmdb", "genre pulse failed", e);
    return null;
  }
  const hot = pulse.filter((p) => p.lift >= 1.15 && GENRES.some((g) => g.id === p.id)).slice(0, 6);
  if (!hot.length) return null;
  const cooling = [...pulse].reverse().find((p) => p.lift < 0.75 && GENRES.some((g) => g.id === p.id));
  return (
    <section className="section pulse" aria-labelledby="pulse-title">
      <div className="section-head">
        <div>
          <h2 id="pulse-title">📈 {title}</h2>
          <p>Compared with how often each genre usually shows up — from TMDB&apos;s trending lists, refreshed every few hours.</p>
        </div>
      </div>
      <ol className="pulse-list">
        {hot.map((p, i) => {
          const g = GENRES.find((x) => x.id === p.id)!;
          return (
            <li key={p.id}>
              <Link href={`/genre/${g.slug}`} className="pulse-item">
                <span className="pulse-rank">{i + 1}</span>
                <strong>{g.name}</strong>
                <span className="pulse-lift" title={`${Math.round(p.share * 100)}% of this week's trending attention`}>
                  ↑ {p.lift.toFixed(1)}×
                </span>
                <span className="pulse-bar" aria-hidden style={{ ["--w" as string]: `${Math.min(100, (p.lift / hot[0].lift) * 100)}%` }} />
              </Link>
            </li>
          );
        })}
      </ol>
      {cooling && (
        <p className="muted-note" style={{ marginTop: 10 }}>
          Cooling off: {GENRES.find((g) => g.id === cooling.id)!.name} ({cooling.lift.toFixed(1)}× its usual share).
        </p>
      )}
    </section>
  );
}
