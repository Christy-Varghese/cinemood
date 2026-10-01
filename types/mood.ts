export type MoodSlug =
  | "happy"
  | "romantic"
  | "funny"
  | "emotional"
  | "exciting"
  | "scary"
  | "thoughtful"
  | "relaxing"
  | "motivating"
  | "inspiring"
  | "mind_bending"
  | "dark"
  | "nostalgic"
  | "adventurous"
  | "comforting"
  | "hopeful"
  | "intense"
  | "mysterious"
  | "feel_good"
  | "sad";

export interface Mood {
  id: string;
  slug: MoodSlug;
  name: string;
  icon: string;
  description: string;
  /** One-line page subtitle, e.g. "Movies for when you want a love story." */
  tagline: string;
  /** Accent colour (hex) used for chips and the mood DNA bars. */
  accent: string;
  isActive: boolean;
  /** Shown in the primary home-page selector. */
  featured: boolean;
  sortOrder: number;
}

export interface MoodScore {
  mood: MoodSlug;
  /** 0.00 – 1.00: how strongly the movie carries this mood. */
  score: number;
  /** 0.00 – 1.00: how sure the classifier is. */
  confidence: number;
}

export interface MoodProfile {
  scores: Partial<Record<MoodSlug, number>>;
  confidence: number;
  source: "ai" | "rules" | "manual" | "database";
  modelVersion: string;
  calculatedAt: string;
}
