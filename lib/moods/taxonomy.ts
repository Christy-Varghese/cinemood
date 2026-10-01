import type { Mood, MoodSlug } from "@/types/mood";

/**
 * Canonical mood taxonomy. This is the SEED for the `moods` table
 * (supabase/migrations/0002_seed.sql is generated from the same values).
 * At runtime, `getMoods()` in lib/moods/repository.ts reads the database
 * when Supabase is configured and falls back to this seed otherwise —
 * components never import this file directly.
 */
export const MOOD_SEED: Mood[] = [
  { id: "m01", slug: "happy", name: "Happy", icon: "😊", description: "Bright, light and good for the soul.", tagline: "Movies that leave you smiling.", accent: "#F7C948", isActive: true, featured: true, sortOrder: 1 },
  { id: "m02", slug: "romantic", name: "Romantic", icon: "❤️", description: "Love stories, longing and chemistry.", tagline: "Movies for when you want a love story.", accent: "#F2667A", isActive: true, featured: true, sortOrder: 2 },
  { id: "m03", slug: "funny", name: "Funny", icon: "😂", description: "Laugh-out-loud and quietly witty.", tagline: "Movies that actually make you laugh.", accent: "#FFB347", isActive: true, featured: true, sortOrder: 3 },
  { id: "m04", slug: "emotional", name: "Emotional", icon: "😢", description: "Stories that hit you in the chest.", tagline: "Movies for a good cry.", accent: "#7AA7FF", isActive: true, featured: true, sortOrder: 4 },
  { id: "m05", slug: "exciting", name: "Exciting", icon: "🔥", description: "Pace, stakes and adrenaline.", tagline: "Movies that keep you on the edge of your seat.", accent: "#FF7A45", isActive: true, featured: true, sortOrder: 5 },
  { id: "m06", slug: "scary", name: "Scary", icon: "😱", description: "Dread, jump-scares and things in the dark.", tagline: "Movies to watch with the lights on.", accent: "#B583FF", isActive: true, featured: true, sortOrder: 6 },
  { id: "m07", slug: "thoughtful", name: "Thoughtful", icon: "🧠", description: "Ideas that stay with you after the credits.", tagline: "Movies that make you think.", accent: "#5FD3C6", isActive: true, featured: true, sortOrder: 7 },
  { id: "m08", slug: "relaxing", name: "Relaxing", icon: "😌", description: "Gentle, low-stakes and easy to sink into.", tagline: "Movies for a slow evening.", accent: "#8FD694", isActive: true, featured: true, sortOrder: 8 },
  { id: "m09", slug: "motivating", name: "Motivating", icon: "💪", description: "Underdogs, grit and getting back up.", tagline: "Movies that make you want to do something.", accent: "#FF9F43", isActive: true, featured: true, sortOrder: 9 },
  { id: "m10", slug: "mind_bending", name: "Mind-Bending", icon: "🤯", description: "Twists, puzzles and unreliable realities.", tagline: "Movies that mess with your head.", accent: "#9B8CFF", isActive: true, featured: true, sortOrder: 10 },
  { id: "m11", slug: "dark", name: "Dark", icon: "🌙", description: "Bleak, morally grey and unflinching.", tagline: "Movies that go to uncomfortable places.", accent: "#8A93A6", isActive: true, featured: true, sortOrder: 11 },
  { id: "m12", slug: "inspiring", name: "Inspiring", icon: "✨", description: "Real courage and big-hearted ambition.", tagline: "Movies that lift you up.", accent: "#FFD166", isActive: true, featured: true, sortOrder: 12 },
  { id: "m13", slug: "nostalgic", name: "Nostalgic", icon: "📼", description: "Coming-of-age, memory and simpler times.", tagline: "Movies that feel like looking back.", accent: "#D4A373", isActive: true, featured: false, sortOrder: 13 },
  { id: "m14", slug: "adventurous", name: "Adventurous", icon: "🧭", description: "Journeys, quests and wide horizons.", tagline: "Movies that take you somewhere new.", accent: "#4CC9F0", isActive: true, featured: false, sortOrder: 14 },
  { id: "m15", slug: "comforting", name: "Comforting", icon: "🫖", description: "Warm, familiar and kind.", tagline: "Movies that feel like a blanket.", accent: "#E9B872", isActive: true, featured: false, sortOrder: 15 },
  { id: "m16", slug: "hopeful", name: "Hopeful", icon: "🌅", description: "Light at the end of the tunnel.", tagline: "Movies that believe things get better.", accent: "#F4A261", isActive: true, featured: false, sortOrder: 16 },
  { id: "m17", slug: "intense", name: "Intense", icon: "⚡", description: "Relentless tension that never lets go.", tagline: "Movies that grip and don't let go.", accent: "#E63946", isActive: true, featured: false, sortOrder: 17 },
  { id: "m18", slug: "mysterious", name: "Mysterious", icon: "🕵️", description: "Secrets, clues and slow reveals.", tagline: "Movies with a puzzle at the centre.", accent: "#6C8EBF", isActive: true, featured: false, sortOrder: 18 },
  { id: "m19", slug: "feel_good", name: "Feel-Good", icon: "🌈", description: "Pure, uncomplicated joy.", tagline: "Movies that just make the day better.", accent: "#72EFDD", isActive: true, featured: false, sortOrder: 19 },
  { id: "m20", slug: "sad", name: "Sad", icon: "🥀", description: "Melancholy, loss and quiet heartbreak.", tagline: "Movies for when you want to feel it.", accent: "#6D7FA6", isActive: true, featured: false, sortOrder: 20 },
];

export const MOOD_SLUGS = MOOD_SEED.map((m) => m.slug) as MoodSlug[];

export function isMoodSlug(value: string): value is MoodSlug {
  return (MOOD_SLUGS as string[]).includes(value);
}

/** URL-friendly form: mind_bending ⇄ mind-bending */
export const moodToUrl = (slug: MoodSlug) => slug.replace(/_/g, "-");
export const moodFromUrl = (value: string) => value.replace(/-/g, "_");
