import Link from "next/link";
import type { Metadata } from "next";
import { MovieGrid } from "@/components/movie/MovieRail";
import { ConfigNotice, ErrorState } from "@/components/ui/States";
import { getList, type ListKind } from "@/lib/tmdb/movies";
import { load } from "@/lib/load";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Movies", alternates: { canonical: "/movies" } };

const LISTS: { key: ListKind; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "now_playing", label: "Now playing" },
  { key: "upcoming", label: "Upcoming" },
  { key: "top_rated", label: "Top rated" },
];

export default async function MoviesPage({ searchParams }: { searchParams: Promise<{ list?: string; page?: string }> }) {
  const sp = await searchParams;
  const list = (LISTS.find((l) => l.key === sp.list)?.key ?? "popular") as ListKind;
  const page = Math.min(50, Math.max(1, Number(sp.page) || 1));
  const res = await load(() => getList(list, page, list === "popular" || list === "top_rated" ? undefined : env.defaultRegion));
  return (
    <div className="container">
      <header className="page-head">
        <h1>Movies</h1>
      </header>
      <nav className="tabs" aria-label="Lists" style={{ margin: "24px 0 28px" }}>
        {LISTS.map((l) => (
          <Link key={l.key} className="tab" href={`/movies?list=${l.key}`} aria-current={l.key === list ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      {!res.ok ? (
        res.reason === "config" ? <ConfigNotice /> : <ErrorState retryHref={`/movies?list=${list}`} />
      ) : (
        <>
          <MovieGrid movies={res.data.results} />
          <nav className="hero-actions" aria-label="Pagination">
            {page > 1 && (
              <Link className="btn btn-outline" href={`/movies?list=${list}&page=${page - 1}`}>
                Previous
              </Link>
            )}
            {page < Math.min(50, res.data.totalPages) && (
              <Link className="btn btn-ghost" href={`/movies?list=${list}&page=${page + 1}`}>
                Next page
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
