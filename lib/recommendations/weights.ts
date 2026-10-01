import type { RecommendationWeights } from "@/types/recommendation";

/** Default weights from the master spec — overridable via admin (recommendation_configs). */
export const DEFAULT_WEIGHTS: RecommendationWeights = {
  mood: 0.35,
  language: 0.15,
  preference: 0.15,
  genre: 0.1,
  rating: 0.1,
  popularity: 0.05,
  freshness: 0.05,
  diversity: 0.05,
};
