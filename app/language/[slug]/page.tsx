import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MovieRail } from "@/components/movie/MovieRail";
import { ConfigNotice, ErrorState } from "@/components/ui/States";
import { discover } from "@/lib/tmdb/movies";
import { LANGUAGES, languageFromSlug, languageSlug } from "@/lib/reference";
import { loadAll } from "@/lib/load";
import { queryToParams } from "@/lib/search/query";
import { getMoods } from "@/lib/db/repository";
import { moodToUrl } from "@/lib/moods/taxonomy";

export const revalidate = 21600;

export function generateStaticParams() {
  return LANGUAGES.map((l) => ({ slug: languageSlug(l.code) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = languageFromSlug((await params).slug);
  if (!l) return { title: "Language not found" };
  return {
    title: `${l.name} movies`,
    description: `Popular, new, top-rated and hidden-gem ${l.name} movies — find one that matches your mood.`,
    alternates: { canonical: `/language/${languageSlug(l.code)}` },
  };
}

export default async function LanguagePage({ params }: { params: Promise<{ slug: string }> }) {
  const l = languageFromSlug((await params).slug);
  if (!l) notFound();
  const regional = l.code !== "en";
  const floor = regional ? 15 : 200;
  const now = new Date();
  const recent = new Date(now.getTime() - 120 * 864e5).toISOString().slice(0, 10);
  const res = await loadAll({
    popular: () => discover({ language: l.code, minVotes: floor }),
    trending: () => discover({ language: l.code, minVotes: Math.ceil(floor / 3), releaseFrom: `${now.getFullYear() - 2}-01-01` }),
    fresh: () => discover({ language: l.code, minVotes: 1, releaseFrom: recent, releaseTo: now.toISOString().slice(0, 10), sortBy: "primary_release_date.desc" }),
    top: () => discover({ language: l.code, minVotes: floor * 2, sortBy: "vote_average.desc" }),
    gems: () => discover({ language: l.code, minVotes: Math.ceil(floor / 2), maxVotes: regional ? 200 : 1500, minRating: 7.2, sortBy: "vote_average.desc" }),
  });
  const moods = await getMoods();

  return (
    <div className="container">
      <header className="page-head">
        <h1>
          <span lang={l.code}>{l.nativeName}</span>
          {l.nativeName !== l.name && <span style={{ color: "var(--muted)" }}> · {l.name}</span>}
        </h1>
        <p>{l.name}-language cinema — original language, wherever it was made.</p>
        <div className="chip-row" style={{ marginTop: 18 }}>
          {moods
            .filter((m) => m.featured)
            .slice(0, 8)
            .map((m) => (
              <Link
                key={m.slug}
                className="chip"
                style={{ ["--chip" as string]: m.accent, minHeight: 36, fontSize: "0.9rem" }}
                href={`/discover?${queryToParams({ moods: [m.slug], languages: [l.code] })}`}
              >
                <span aria-hidden>{m.icon}</span> {m.name}
              </Link>
            ))}
        </div>
      </header>
      {!res.ok ? (
        res.reason === "config" ? <ConfigNotice /> : <ErrorState retryHref={`/language/${languageSlug(l.code)}`} />
      ) : (
        <>
          <MovieRail title="Popular" movies={res.data.popular?.results ?? []} priority />
          <MovieRail title="Trending" subtitle="Popular releases from the last two years." movies={res.data.trending?.results ?? []} />
          <MovieRail title="New releases" movies={res.data.fresh?.results ?? []} />
          <MovieRail title="Top rated" movies={res.data.top?.results ?? []} />
          <MovieRail title="Hidden gems" subtitle="Highly rated, rarely seen." movies={res.data.gems?.results ?? []} />
          <p className="muted-note section">
            Looking for something specific?{" "}
            <Link href={`/discover?lang=${l.code}`} style={{ textDecoration: "underline" }}>
              Filter {l.name} movies by mood
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
