import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { Filmography } from "@/components/person/Filmography";
import { MovieRail } from "@/components/movie/MovieRail";
import { ConfigNotice, ErrorState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { getPerson } from "@/lib/tmdb/people";
import { TmdbError, TmdbNotConfiguredError } from "@/lib/tmdb/client";
import { IMG } from "@/lib/tmdb/images";
import { personPath } from "@/lib/format";
import { logError } from "@/lib/logger";

export const revalidate = 86400;

const getDetail = cache((id: number) => getPerson(id));
const idFrom = (raw: string) => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
function age(birth: string, until?: string | null) {
  const b = new Date(`${birth}T12:00:00Z`);
  const e = until ? new Date(`${until}T12:00:00Z`) : new Date();
  let a = e.getUTCFullYear() - b.getUTCFullYear();
  if (e.getUTCMonth() < b.getUTCMonth() || (e.getUTCMonth() === b.getUTCMonth() && e.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = idFrom((await params).id);
  if (!id) return { title: "Person not found" };
  try {
    const p = await getDetail(id);
    const desc = p.biography ? p.biography.slice(0, 155) : `${p.name}'s films on CineMood.`;
    const img = IMG.profile(p.profilePath, "h632");
    return {
      title: `${p.name} — films`,
      description: desc,
      alternates: { canonical: personPath(p) },
      openGraph: { title: p.name, description: desc, type: "profile", images: img ? [{ url: img }] : [] },
    };
  } catch {
    return { title: "Person" };
  }
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = idFrom(raw);
  if (!id) notFound();

  let person: Awaited<ReturnType<typeof getDetail>>;
  try {
    person = await getDetail(id);
  } catch (e) {
    if (e instanceof TmdbNotConfiguredError)
      return (
        <div className="container">
          <ConfigNotice />
        </div>
      );
    if (e instanceof TmdbError && e.status === 404) notFound();
    logError("tmdb", "person page failed", e);
    return (
      <div className="container">
        <ErrorState retryHref={`/person/${raw}`} />
      </div>
    );
  }

  const canonical = personPath(person);
  if (`/person/${raw}` !== canonical) permanentRedirect(canonical);

  const photo = IMG.profile(person.profilePath, "h632");
  // "Known for": their most-voted films in their main department.
  const knownFor = person.credits
    .filter((c) => c.departments.includes(person.knownFor) && c.movie.voteCount > 0)
    .sort((a, b) => b.movie.voteCount - a.movie.voteCount)
    .slice(0, 10)
    .map((c) => c.movie);
  const paragraphs = person.biography.split(/\n+/).filter(Boolean);
  const facts = [
    person.knownFor && { k: "Known for", v: person.knownFor },
    person.birthday && { k: "Born", v: `${longDate(person.birthday)}${person.deathday ? "" : ` (age ${age(person.birthday)})`}` },
    person.deathday && { k: "Died", v: `${longDate(person.deathday)}${person.birthday ? ` (aged ${age(person.birthday, person.deathday)})` : ""}` },
    person.placeOfBirth && { k: "Birthplace", v: person.placeOfBirth },
    { k: "Films", v: String(person.credits.length) },
  ].filter(Boolean) as { k: string; v: string }[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    birthDate: person.birthday ?? undefined,
    deathDate: person.deathday ?? undefined,
    birthPlace: person.placeOfBirth ?? undefined,
    image: photo ?? undefined,
    sameAs: [person.imdbId && `https://www.imdb.com/name/${person.imdbId}/`, person.instagram && `https://www.instagram.com/${person.instagram}/`].filter(Boolean),
  };

  return (
    <article className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="person-hero">
        <div className="person-photo">{photo ? <Image src={photo} alt={person.name} fill priority sizes="220px" /> : <span aria-hidden>{person.name.slice(0, 1)}</span>}</div>
        <div className="person-info">
          <p className="eyebrow">{person.knownFor === "Acting" ? "Actor" : person.knownFor}</p>
          <h1>{person.name}</h1>
          <dl className="person-facts">
            {facts.map((f) => (
              <div key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
          <div className="chip-row" style={{ marginTop: 16 }}>
            {person.instagram && (
              <a className="chip" href={`https://www.instagram.com/${encodeURIComponent(person.instagram)}/`} target="_blank" rel="noreferrer">
                <Icon name="instagram" size={14} /> Instagram
              </a>
            )}
            {person.imdbId && (
              <a className="chip" href={`https://www.imdb.com/name/${person.imdbId}/`} target="_blank" rel="noreferrer">
                IMDb <Icon name="external" size={13} />
              </a>
            )}
            {person.wikidataId && (
              <a className="chip" href={`https://www.wikidata.org/wiki/${person.wikidataId}`} target="_blank" rel="noreferrer">
                Wikidata <Icon name="external" size={13} />
              </a>
            )}
          </div>
        </div>
      </header>

      {paragraphs.length > 0 && (
        <section className="section" aria-labelledby="bio">
          <h2 id="bio" style={{ marginBottom: 12 }}>
            Biography
          </h2>
          {paragraphs.length > 1 || paragraphs[0].length > 600 ? (
            <details className="bio">
              <summary>
                <p className="prose">{paragraphs[0].length > 600 ? `${paragraphs[0].slice(0, 560).trimEnd()}…` : paragraphs[0]}</p>
                <span className="bio-more">Read full biography</span>
              </summary>
              {paragraphs.map((p, i) => (
                <p className="prose" key={i}>
                  {p}
                </p>
              ))}
            </details>
          ) : (
            <p className="prose">{paragraphs[0]}</p>
          )}
          <p className="muted-note" style={{ marginTop: 8 }}>
            Biography from TMDB.
          </p>
        </section>
      )}

      {knownFor.length > 3 && <MovieRail title="Known for" movies={knownFor} />}

      <section className="section" aria-labelledby="films">
        <h2 id="films" style={{ marginBottom: 16 }}>
          Filmography
        </h2>
        <Filmography name={person.name} knownFor={person.knownFor} credits={person.credits} />
      </section>
    </article>
  );
}
