import { ruleBasedProfile } from "@/lib/mood-engine/rules";
import { toLite } from "@/lib/format";
import type { MovieSummary } from "@/types/movie";
import type { MoodProfile } from "@/types/mood";

/** Card-ready movie with its top moods (stored profile when given, rules otherwise). */
export function liteWithMoods(m: MovieSummary, profile?: MoodProfile) {
  return toLite(m, profile ?? ruleBasedProfile({ genreIds: m.genreIds, overview: m.overview, voteAverage: m.voteAverage }));
}
