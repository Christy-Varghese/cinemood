/**
 * Seasonal calendar — pure, no server imports (unit-tested, safe anywhere).
 *
 * The site re-reads this on every revalidation, so what's featured changes by
 * itself as the date moves: spooky season in October, holiday films in December,
 * romance before Valentine's, blockbusters in summer… Nobody has to edit anything.
 */

export interface SeasonQuery {
  genres?: number[];
  /** TMDB keyword names, resolved to ids at request time. */
  keywords?: string[];
  language?: string;
  minVotes?: number;
  minRating?: number;
  sortBy?: "popularity.desc" | "vote_average.desc" | "vote_count.desc";
  /** Only films released in the last N years (e.g. awards season). */
  recentYears?: number;
}

export interface Season {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  /** One line on why it's featured right now. */
  why: string;
  accent: string;
  moods: string[];
  /** Higher wins when several seasons overlap. */
  priority: number;
  /** Regions where it applies; omitted = everywhere. */
  regions?: string[];
  window: (year: number) => { start: Date; end: Date } | null;
  query: SeasonQuery;
}

const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const fixed = (m1: number, d1: number, m2: number, d2: number) => (y: number) => ({ start: D(y, m1, d1), end: D(y, m2, d2) });

/** nth weekday of a month (weekday 0=Sun…6=Sat, n=1…5). */
export function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = D(year, month, 1).getUTCDay();
  return D(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}
const around = (day: Date, before: number, after: number) => ({
  start: new Date(day.getTime() - before * 86_400_000),
  end: new Date(day.getTime() + after * 86_400_000),
});

/** Diwali follows the lunar calendar — dates per year (Lakshmi Puja day). */
const DIWALI: Record<number, [number, number]> = { 2026: [11, 8], 2027: [10, 29], 2028: [10, 17] };

export const SEASONS: Season[] = [
  {
    slug: "spooky-season",
    name: "Spooky season",
    emoji: "🎃",
    tagline: "Horror, haunted houses and things that go bump in the night.",
    why: "It's October — the month everyone watches horror.",
    accent: "#FF7A1A",
    moods: ["scary", "mysterious", "intense"],
    priority: 10,
    window: fixed(10, 1, 10, 31),
    query: { genres: [27], minVotes: 400, sortBy: "popularity.desc" },
  },
  {
    slug: "halloween-night",
    name: "Halloween night",
    emoji: "👻",
    tagline: "Films set on Halloween itself — costumes, candy and carnage.",
    why: "Halloween is days away.",
    accent: "#B583FF",
    moods: ["scary", "funny"],
    priority: 12,
    window: fixed(10, 24, 11, 1),
    query: { keywords: ["halloween"], minVotes: 100 },
  },
  {
    slug: "thanksgiving-ca",
    name: "Thanksgiving weekend",
    emoji: "🦃",
    tagline: "Big-family chaos, homecomings and films everyone at the table can agree on.",
    why: "It's Thanksgiving weekend in Canada.",
    accent: "#D98E3B",
    moods: ["comforting", "funny", "feel_good"],
    priority: 11,
    regions: ["CA"],
    window: (y) => around(nthWeekday(y, 10, 1, 2), 4, 1),
    query: { genres: [10751, 35], minVotes: 500, minRating: 6.5 },
  },
  {
    slug: "thanksgiving-us",
    name: "Thanksgiving weekend",
    emoji: "🦃",
    tagline: "Big-family chaos, homecomings and films everyone at the table can agree on.",
    why: "It's Thanksgiving week in the US.",
    accent: "#D98E3B",
    moods: ["comforting", "funny", "feel_good"],
    priority: 11,
    regions: ["US"],
    window: (y) => around(nthWeekday(y, 11, 4, 4), 5, 3),
    query: { genres: [10751, 35], minVotes: 500, minRating: 6.5 },
  },
  {
    slug: "diwali",
    name: "Diwali",
    emoji: "🪔",
    tagline: "Festive Bollywood — big families, bigger songs, happy endings.",
    why: "It's Diwali week.",
    accent: "#FFB627",
    moods: ["happy", "romantic", "feel_good"],
    priority: 11,
    window: (y) => (DIWALI[y] ? around(D(y, DIWALI[y][0], DIWALI[y][1]), 7, 3) : null),
    query: { language: "hi", genres: [10751, 35, 10749, 10402], minVotes: 80, sortBy: "vote_count.desc" },
  },
  {
    slug: "cozy-autumn",
    name: "Cozy autumn",
    emoji: "🍂",
    tagline: "Sweater weather: warm dramas, slow romances and small towns.",
    why: "The nights are getting longer.",
    accent: "#C9733B",
    moods: ["comforting", "nostalgic", "relaxing"],
    priority: 4,
    window: fixed(9, 16, 11, 30),
    query: { genres: [18, 10749, 10751], minVotes: 800, minRating: 7, sortBy: "vote_average.desc" },
  },
  {
    slug: "holiday-season",
    name: "Holiday season",
    emoji: "🎄",
    tagline: "Christmas classics, snowed-in romances and family chaos.",
    why: "It's December — holiday movie season.",
    accent: "#E63946",
    moods: ["comforting", "feel_good", "happy"],
    priority: 10,
    window: fixed(11, 20, 12, 31),
    query: { keywords: ["christmas"], minVotes: 150 },
  },
  {
    slug: "fresh-start",
    name: "Fresh start",
    emoji: "✨",
    tagline: "New year, new you — underdogs, reinventions and second chances.",
    why: "A new year just started.",
    accent: "#FFD166",
    moods: ["motivating", "inspiring", "hopeful"],
    priority: 8,
    window: fixed(1, 1, 1, 14),
    query: { keywords: ["underdog", "second chance"], minVotes: 200 },
  },
  {
    slug: "awards-season",
    name: "Awards season",
    emoji: "🏆",
    tagline: "Last year's most acclaimed films — catch up before the Oscars.",
    why: "Awards season runs from January to the Oscars.",
    accent: "#F0B04A",
    moods: ["thoughtful", "emotional"],
    priority: 6,
    window: fixed(1, 10, 3, 20),
    query: { minVotes: 300, minRating: 7.2, sortBy: "vote_count.desc", recentYears: 1 },
  },
  {
    slug: "valentines",
    name: "Valentine's",
    emoji: "💘",
    tagline: "Swoon-worthy romances for date night — or a night in.",
    why: "Valentine's Day is coming up.",
    accent: "#F2667A",
    moods: ["romantic", "happy"],
    priority: 10,
    window: fixed(2, 1, 2, 15),
    query: { genres: [10749], minVotes: 800, minRating: 6.8 },
  },
  {
    slug: "spring-reset",
    name: "Spring reset",
    emoji: "🌱",
    tagline: "Light, bright adventures to shake off the winter.",
    why: "Spring is here.",
    accent: "#8FD694",
    moods: ["adventurous", "feel_good", "hopeful"],
    priority: 3,
    window: fixed(3, 21, 5, 31),
    query: { genres: [12, 35, 10751], minVotes: 800, minRating: 6.8 },
  },
  {
    slug: "pride",
    name: "Pride month",
    emoji: "🏳️‍🌈",
    tagline: "Queer love stories, coming-out comedies and landmark LGBTQ+ cinema.",
    why: "June is Pride month.",
    accent: "#9B8CFF",
    moods: ["romantic", "inspiring"],
    priority: 7,
    window: fixed(6, 1, 6, 30),
    query: { keywords: ["lgbt"], minVotes: 150, minRating: 6.5 },
  },
  {
    slug: "summer-blockbusters",
    name: "Summer blockbusters",
    emoji: "☀️",
    tagline: "Popcorn-sized action, adventure and sci-fi spectacle.",
    why: "It's summer — blockbuster season.",
    accent: "#4CC9F0",
    moods: ["exciting", "adventurous"],
    priority: 5,
    window: fixed(6, 1, 8, 31),
    query: { genres: [28, 12, 878], minVotes: 2000 },
  },
  {
    slug: "back-to-school",
    name: "Back to school",
    emoji: "🎒",
    tagline: "Coming-of-age stories, high-school chaos and first loves.",
    why: "School's starting again.",
    accent: "#72EFDD",
    moods: ["nostalgic", "funny"],
    priority: 7,
    window: fixed(8, 20, 9, 15),
    query: { keywords: ["coming of age"], minVotes: 300 },
  },
];

const inWindow = (s: Season, at: Date) =>
  [at.getUTCFullYear() - 1, at.getUTCFullYear()].some((y) => {
    const w = s.window(y);
    // windows are inclusive of the whole end day
    return !!w && at >= w.start && at.getTime() < w.end.getTime() + 86_400_000;
  });

const appliesTo = (s: Season, region?: string) => !s.regions || !region || s.regions.includes(region.toUpperCase());

/** Seasons active on this date, most relevant first. Always returns at least one. */
export function activeSeasons(at: Date = new Date(), region?: string): Season[] {
  const day = D(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
  const list = SEASONS.filter((s) => appliesTo(s, region) && inWindow(s, day)).sort((a, b) => b.priority - a.priority);
  return list.length ? list : [FALLBACK];
}

/** The next season to start after this date (within ~4 months), with its start date. */
export function nextSeason(at: Date = new Date(), region?: string): { season: Season; starts: Date } | null {
  const day = D(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
  const active = new Set(activeSeasons(at, region).map((s) => s.slug));
  let best: { season: Season; starts: Date } | null = null;
  for (const s of SEASONS) {
    if (!appliesTo(s, region) || active.has(s.slug)) continue;
    for (const y of [day.getUTCFullYear(), day.getUTCFullYear() + 1]) {
      const w = s.window(y);
      if (!w || w.start <= day) continue;
      if (w.start.getTime() - day.getTime() > 125 * 86_400_000) continue;
      if (!best || w.start < best.starts || (w.start.getTime() === best.starts.getTime() && s.priority > best.season.priority)) best = { season: s, starts: w.start };
    }
  }
  return best;
}

export const seasonBySlug = (slug: string) => SEASONS.find((s) => s.slug === slug) ?? (slug === FALLBACK.slug ? FALLBACK : undefined);

const FALLBACK: Season = {
  slug: "crowd-pleasers",
  name: "Crowd-pleasers",
  emoji: "🍿",
  tagline: "Well-loved films that work for almost any night.",
  why: "Always in season.",
  accent: "#F0B04A",
  moods: ["feel_good", "exciting"],
  priority: 0,
  window: () => null,
  query: { minVotes: 3000, minRating: 7.3, sortBy: "popularity.desc" },
};
