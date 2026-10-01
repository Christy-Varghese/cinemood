import type { MoodSlug } from "./mood";
import type { MovieSummary } from "./movie";
import type { MoodProfile } from "./mood";

export type AvailabilityFilter = "any" | "stream" | "rent" | "buy";
export type SortKey = "recommended" | "rating" | "popularity" | "newest";

/** Structured preferences — what the NL parser produces and the engine consumes. */
export interface DiscoveryQuery {
  moods: MoodSlug[];
  languages: string[];
  genres: number[];
  minYear: number | null;
  maxYear: number | null;
  maxRuntime: number | null;
  minRuntime: number | null;
  minRating: number | null;
  region: string | null;
  availability: AvailabilityFilter;
  sort: SortKey;
  /** Free text kept for traditional title/person search. */
  text?: string | null;
}

export interface RecommendationWeights {
  mood: number;
  language: number;
  genre: number;
  preference: number;
  rating: number;
  popularity: number;
  freshness: number;
  diversity: number;
}

export interface TasteProfile {
  moods: Partial<Record<MoodSlug, number>>;
  languages: Record<string, number>;
  genres: Record<string, number>;
  /** TMDB ids the user disliked or skipped recently — pushed down. */
  negative: number[];
  /** TMDB ids already watched — excluded from results. */
  watched: number[];
}

export type ResultLabel =
  | "Great mood match"
  | "Matches your taste"
  | "Popular right now"
  | "Highly rated"
  | "New discovery"
  | "Fresh release";

export interface ScoredMovie {
  movie: MovieSummary;
  profile: MoodProfile;
  score: number;
  moodMatch: number;
  breakdown: Record<keyof RecommendationWeights, number>;
  labels: ResultLabel[];
  explanation: string;
}

export interface RecommendationResponse {
  query: DiscoveryQuery;
  results: ScoredMovie[];
  total: number;
  requestId: string;
}
