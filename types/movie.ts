import type { MoodProfile } from "./mood";

/** A movie as CineMood uses it internally — normalized from TMDB. */
export interface MovieSummary {
  tmdbId: number;
  title: string;
  originalTitle: string;
  originalLanguage: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  /** Runtime in minutes — only known after a details call. */
  runtime?: number | null;
  /** Production country ISO codes — only known after a details call. */
  countries?: string[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

export interface Review {
  id: string;
  author: string;
  username: string | null;
  avatarPath: string | null;
  /** Author's own rating out of 10, when they gave one. */
  rating: number | null;
  content: string;
  createdAt: string;
  url: string;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface WatchAvailability {
  region: string;
  /** TMDB's JustWatch-powered link for this title/region. */
  link: string | null;
  subscription: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

export interface Video {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface MovieDetail extends MovieSummary {
  tagline: string | null;
  /** IMDb id (tt…) — the join key for OMDb, Trakt and Wikidata. */
  imdbId: string | null;
  runtime: number | null;
  status: string | null;
  homepage: string | null;
  genres: { id: number; name: string }[];
  spokenLanguages: { code: string; name: string }[];
  countries: string[];
  countryNames: { code: string; name: string }[];
  keywords: string[];
  cast: CastMember[];
  directors: CrewMember[];
  writers: CrewMember[];
  reviews: Review[];
  reviewTotal: number;
  trailer: Video | null;
  availability: WatchAvailability | null;
  similar: MovieSummary[];
  moodProfile: MoodProfile;
}

export interface Paged<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}
