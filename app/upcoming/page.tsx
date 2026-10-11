import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Poster } from "@/components/movie/Poster";
import { MoodChips } from "@/components/mood/MoodChips";
import { RemindButton } from "@/components/upcoming/RemindButton";
import { ConfigNotice, EmptyState, ErrorState } from "@/components/ui/States";
import { getReleases } from "@/lib/tmdb/movies";
import { load } from "@/lib/load";
import { env } from "@/lib/env";
import { genreName, REGIONS } from "@/lib/reference";
import { lang, moviePath } from "@/lib/format";
import { liteWithMoods } from "@/lib/movie-lite";

export const metadata: Metadata = {
  title: "Upcoming movies this month",
  description: "Every notable film releasing this month in theatres and on digital — with synopsis, release date and mood.",
  alternates: { canonical: "/upcoming" },
};

const pad = (n: number) => String(n).padStart(2, "0");
function monthRange(offset: number) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + offset;
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: iso(first), to: iso(last), label: first.toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

const cachedReleases = (from: string, to: string, region: string) => unstable_cache(() => getReleases(from, to, region), ["releases-v1", from, to, region], { revalidate: 60 * 60 * 6, tags: ["releases"] })();

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

export default async function UpcomingPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const offset = (await searchParams).m === "next" ? 1 : 0;
  const range = monthRange(offset);
  const region = env.defaultRegion;
  const regionName = REGIONS.find((r) => r.code === region)?.name ?? region;
  const res = await load(() => cachedReleases(range.from, range.to, region));
  if (!res.ok) return <div className="container">{res.reason === "config" ? <ConfigNotice /> : <ErrorState retryHref="/upcoming" />}</div>;

  const today = new Date().toISOString().slice(0, 10);
  const byDay = new Map<string, typeof res.data>();
  for (const r of res.data) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const comingCount = res.data.filter((r) => r.date >= today).length;

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">Release calendar · {regionName}</p>
        <h1>Upcoming in {range.label.split(" ")[0]}</h1>
        <p>
          {offset === 0
            ? `${res.data.length} films release this month in theatres or on digital${comingCount < res.data.length ? `, ${comingCount} still to come` : ""}.`
            : `${res.data.length} films announced for next month so far.`}{" "}
          Save one to your watchlist and it&apos;ll be waiting there on release day.
        </p>
      </header>

      <nav className="tabs" aria-label="Month" style={{ marginBottom: 28 }}>
        <Link href="/upcoming" className="tab" aria-current={offset === 0 ? "page" : undefined} aria-selected={offset === 0}>
          This month
        </Link>
        <Link href="/upcoming?m=next" className="tab" aria-current={offset === 1 ? "page" : undefined} aria-selected={offset === 1}>
          Next month
        </Link>
      </nav>

      {!res.data.length ? (
        <EmptyState icon="🗓️" title="No releases listed yet" body="TMDB hasn't got dates for this month yet. Check back soon." />
      ) : (
        <div className="release-days">
          {[...byDay.entries()].map(([day, list]) => {
            const past = day < today;
            return (
              <section key={day} className={`release-day${past ? " is-past" : ""}`} aria-labelledby={`d-${day}`}>
                <h2 id={`d-${day}`} className="release-date">
                  <span>{dayLabel(day)}</span>
                  {day === today ? <em className="chip">Today</em> : past ? <em className="chip">Out now</em> : null}
                </h2>
                <ol className="release-list">
                  {list.map(({ movie, kind }) => {
                    const lite = liteWithMoods(movie);
                    const genres = movie.genreIds.slice(0, 3).map(genreName).filter((g) => g !== "Other");
                    return (
                      <li key={movie.tmdbId} className="release-row">
                        <Link href={moviePath(movie)} className="release-poster" aria-hidden tabIndex={-1}>
                          <Poster path={movie.posterPath} title={movie.title} size="w185" sizes="110px" />
                        </Link>
                        <div className="release-body">
                          <Link href={moviePath(movie)} className="release-title">
                            {movie.title}
                          </Link>
                          <p className="release-meta">
                            <span className="release-kind">{kind}</span>
                            {[genres.join(", "), lang(movie.originalLanguage)].filter(Boolean).join(" · ")}
                          </p>
                          <p className="release-synopsis">{movie.overview || "No synopsis yet — TMDB hasn't published one for this film."}</p>
                          <div className="release-actions">
                            {lite.moods?.length ? <MoodChips moods={lite.moods} max={2} /> : null}
                            <RemindButton movie={lite} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
      <p className="muted-note" style={{ marginTop: 28 }}>
        Release dates for {regionName} from TMDB; they can still move.
      </p>
    </div>
  );
}
