import type { Metadata } from "next";

export const metadata: Metadata = { title: "About", description: "How CineMood finds a movie for how you feel.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <header className="page-head">
        <h1>Tell us how you feel. We&apos;ll find the movie.</h1>
      </header>
      <div className="prose section" style={{ display: "grid", gap: 18, marginTop: 28 }}>
        <p>
          CineMood is a mood-first way to find films from every language and country. Instead of starting from a title or a genre, you pick how you want to feel — romantic,
          mind-bending, comforting — and the mood engine ranks movies against that.
        </p>
        <h2 style={{ color: "var(--text)" }}>How the mood engine works</h2>
        <p>
          Every movie gets a weighted mood profile — scores from 0 to 100% across twenty moods. Profiles come from a local AI classifier when one is available, and from a
          transparent rules engine (genres, keywords and synopsis language) otherwise. Editors can adjust profiles by hand.
        </p>
        <p>
          Recommendations blend mood match, language, genre, your own taste, rating quality, popularity, freshness and diversity — so a request for
          &ldquo;romantic and emotional&rdquo; can surface a Korean melodrama, a Malayalam family drama and a Japanese animation side by side.
        </p>
        <p>The AI only interprets what you ask for. It never invents movies, ratings, cast or streaming availability — those always come from licensed data.</p>
        <h2 style={{ color: "var(--text)" }}>Data and attribution</h2>
        <p>
          This product uses the TMDB API but is not endorsed or certified by TMDB. Movie metadata, images and user reviews come from{" "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            The Movie Database (TMDB)
          </a>
          . Streaming availability is provided by JustWatch through TMDB. IMDb, Rotten Tomatoes and Metacritic scores come from OMDb (licensed CC BY-NC 4.0), live community signals and audience ratings from Trakt, and awards from Wikidata (CC0). CineMood does not host or stream any movies.
        </p>
      </div>
    </div>
  );
}
