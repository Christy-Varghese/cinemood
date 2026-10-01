import { Icon } from "@/components/ui/Icon";
import { getOmdbRatings } from "@/lib/sources/omdb";
import { getTraktRating } from "@/lib/sources/trakt";
import { getWikidataInfo } from "@/lib/sources/wikidata";
import { rating } from "@/lib/format";

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/**
 * Ratings from IMDb / Rotten Tomatoes / Metacritic (OMDb), Trakt's audience
 * score, and awards (Wikidata + OMDb). Every source is optional; anything
 * missing is simply not shown — nothing is estimated.
 */
export async function ExternalInfo({ imdbId, tmdbRating, tmdbVotes, tmdbId }: { imdbId: string | null; tmdbRating: number; tmdbVotes: number; tmdbId: number }) {
  const [omdb, traktRating, wiki] = await Promise.all([getOmdbRatings(imdbId), getTraktRating(imdbId), getWikidataInfo(imdbId)]);

  const rows: { source: string; value: string; detail?: string; href?: string }[] = [];
  if (tmdbVotes > 0) rows.push({ source: "TMDB", value: `${rating(tmdbRating)}/10`, detail: `${compact(tmdbVotes)} votes`, href: `https://www.themoviedb.org/movie/${tmdbId}` });
  if (omdb?.imdb) rows.push({ source: "IMDb", value: `${omdb.imdb.rating.toFixed(1)}/10`, detail: omdb.imdb.votes ? `${compact(omdb.imdb.votes)} votes` : undefined, href: `https://www.imdb.com/title/${imdbId}/` });
  if (omdb?.rottenTomatoes !== null && omdb?.rottenTomatoes !== undefined) rows.push({ source: "Rotten Tomatoes", value: `${omdb.rottenTomatoes}%`, detail: "Critics" });
  if (omdb?.metacritic !== null && omdb?.metacritic !== undefined) rows.push({ source: "Metacritic", value: `${omdb.metacritic}/100`, detail: "Metascore" });
  if (traktRating) rows.push({ source: "Trakt", value: `${traktRating.rating}/10`, detail: `${compact(traktRating.votes)} votes`, href: traktRating.url });

  const awards = wiki?.awards ?? [];
  const sources = [omdb && "OMDb (CC BY-NC 4.0)", traktRating && "Trakt", wiki && "Wikidata"].filter(Boolean);

  return (
    <>
      {rows.length > 0 && (
        <div className="side-block">
          <h2>Ratings</h2>
          <dl className="ratings">
            {rows.map((r) => (
              <div key={r.source} className="rating-row">
                <dt>{r.href ? <a href={r.href} target="_blank" rel="noreferrer">{r.source}</a> : r.source}</dt>
                <dd>
                  <strong>{r.value}</strong>
                  {r.detail && <span>{r.detail}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {omdb?.certification && (
            <p className="muted-note" style={{ marginTop: 10 }}>
              Rated <strong>{omdb.certification}</strong>
              {omdb.boxOffice && <> · Box office {omdb.boxOffice}</>}
            </p>
          )}
        </div>
      )}

      {(awards.length > 0 || omdb?.awardsSummary) && (
        <div className="side-block">
          <h2>
            <Icon name="star" size={18} filled style={{ color: "var(--star)", verticalAlign: "-2px" }} /> Awards
          </h2>
          {omdb?.awardsSummary && <p style={{ fontWeight: 650, marginBottom: 10 }}>{omdb.awardsSummary}</p>}
          {awards.length > 0 && (
            <ul className="awards">
              {awards.slice(0, 8).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {awards.length > 8 && <p className="muted-note">+{awards.length - 8} more</p>}
          {wiki && wiki.nominations > 0 && <p className="muted-note" style={{ marginTop: 8 }}>{wiki.nominations} major nominations recorded on Wikidata.</p>}
        </div>
      )}

      {(wiki?.wikipediaUrl || imdbId) && (
        <div className="side-block">
          <h2>Learn more</h2>
          <div className="chip-row">
            {wiki?.wikipediaUrl && (
              <a className="chip" href={wiki.wikipediaUrl} target="_blank" rel="noreferrer">
                Wikipedia <Icon name="external" size={13} />
              </a>
            )}
            {imdbId && (
              <a className="chip" href={`https://www.imdb.com/title/${imdbId}/`} target="_blank" rel="noreferrer">
                IMDb <Icon name="external" size={13} />
              </a>
            )}
            {wiki && (
              <a className="chip" href={wiki.wikidataUrl} target="_blank" rel="noreferrer">
                Wikidata <Icon name="external" size={13} />
              </a>
            )}
          </div>
        </div>
      )}

      {sources.length > 0 && <p className="muted-note" style={{ marginTop: 18 }}>Extra data from {sources.join(", ")}.</p>}
    </>
  );
}
