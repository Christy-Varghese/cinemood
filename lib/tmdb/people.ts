import "server-only";
import { tmdb } from "./client";
import { normalizeMovie } from "./movies";
import type { MovieSummary } from "@/types/movie";

interface RawCredit {
  id: number;
  title?: string;
  original_title?: string;
  original_language?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
  character?: string;
  job?: string;
  department?: string;
}
interface RawPerson {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  known_for_department?: string;
  also_known_as?: string[];
  homepage?: string | null;
  movie_credits?: { cast: RawCredit[]; crew: RawCredit[] };
  external_ids?: { imdb_id?: string | null; instagram_id?: string | null; wikidata_id?: string | null; twitter_id?: string | null };
}

/** One film in a person's filmography. A person can hold several roles on the same film. */
export interface Credit {
  movie: MovieSummary;
  /** "Acting" for cast credits, otherwise the TMDB crew department. */
  departments: string[];
  /** Character names and/or crew jobs, e.g. "Cobb" or "Director, Writer". */
  roles: string[];
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownFor: string;
  imdbId: string | null;
  instagram: string | null;
  wikidataId: string | null;
  credits: Credit[];
}

export async function getPerson(id: number): Promise<PersonDetail> {
  const r = await tmdb<RawPerson>(`/person/${id}`, { append_to_response: "movie_credits,external_ids" }, 60 * 60 * 24);
  const map = new Map<number, Credit>();
  const add = (c: RawCredit, dept: string, role: string | undefined) => {
    if (c.adult) return;
    const entry = map.get(c.id) ?? { movie: normalizeMovie(c), departments: [], roles: [] };
    if (!entry.departments.includes(dept)) entry.departments.push(dept);
    const clean = role?.trim();
    if (clean && !entry.roles.includes(clean)) entry.roles.push(clean);
    map.set(c.id, entry);
  };
  for (const c of r.movie_credits?.cast ?? []) add(c, "Acting", c.character);
  for (const c of r.movie_credits?.crew ?? []) add(c, c.department || "Crew", c.job);

  return {
    id: r.id,
    name: r.name,
    biography: r.biography ?? "",
    birthday: r.birthday ?? null,
    deathday: r.deathday ?? null,
    placeOfBirth: r.place_of_birth ?? null,
    profilePath: r.profile_path ?? null,
    knownFor: r.known_for_department ?? "Acting",
    imdbId: r.external_ids?.imdb_id || null,
    instagram: r.external_ids?.instagram_id || null,
    wikidataId: r.external_ids?.wikidata_id || null,
    credits: [...map.values()],
  };
}
