import { isMoodSlug, MOOD_SLUGS } from "@/lib/moods/taxonomy";
import { GENRES, LANGUAGES } from "@/lib/reference";
import type { MoodSlug } from "@/types/mood";
import type { AvailabilityFilter, DiscoveryQuery, SortKey } from "@/types/recommendation";

export const EMPTY_QUERY: DiscoveryQuery = {
  moods: [],
  languages: [],
  genres: [],
  minYear: null,
  maxYear: null,
  maxRuntime: null,
  minRuntime: null,
  minRating: null,
  region: null,
  availability: "any",
  sort: "recommended",
  text: null,
};

const intOrNull = (v: string | null | undefined) => {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const numOrNull = (v: string | null | undefined) => {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const list = (v: string | null | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/** URL ⇄ query. Values are validated so arbitrary input can't reach TMDB unchecked. */
export function queryFromParams(sp: URLSearchParams | Record<string, string | string[] | undefined>): DiscoveryQuery {
  const get = (k: string): string | null => {
    if (sp instanceof URLSearchParams) return sp.get(k);
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const langCodes = new Set(LANGUAGES.map((l) => l.code));
  const genreIds = new Set(GENRES.map((g) => g.id));
  const year = new Date().getFullYear() + 2;
  const clampYear = (y: number | null) => (y && y >= 1900 && y <= year ? y : null);
  const sort = (get("sort") ?? "recommended") as SortKey;
  const availability = (get("where") ?? "any") as AvailabilityFilter;

  return {
    moods: list(get("moods")).map((m) => m.replace(/-/g, "_")).filter(isMoodSlug).slice(0, 3) as MoodSlug[],
    languages: list(get("lang")).filter((l) => langCodes.has(l)).slice(0, 5),
    genres: list(get("genres")).map(Number).filter((g) => genreIds.has(g)).slice(0, 5),
    minYear: clampYear(intOrNull(get("from"))),
    maxYear: clampYear(intOrNull(get("to"))),
    maxRuntime: (() => {
      const r = intOrNull(get("maxRuntime"));
      return r && r > 30 && r < 400 ? r : null;
    })(),
    minRuntime: (() => {
      const r = intOrNull(get("minRuntime"));
      return r && r > 0 && r < 400 ? r : null;
    })(),
    minRating: (() => {
      const r = numOrNull(get("minRating"));
      return r && r > 0 && r <= 10 ? r : null;
    })(),
    region: (get("region") ?? "").match(/^[A-Z]{2}$/) ? get("region") : null,
    availability: ["any", "stream", "rent", "buy"].includes(availability) ? availability : "any",
    sort: ["recommended", "rating", "popularity", "newest"].includes(sort) ? sort : "recommended",
    text: get("q")?.slice(0, 200) || null,
  };
}

export function queryToParams(q: Partial<DiscoveryQuery>): URLSearchParams {
  const p = new URLSearchParams();
  if (q.moods?.length) p.set("moods", q.moods.map((m) => m.replace(/_/g, "-")).join(","));
  if (q.languages?.length) p.set("lang", q.languages.join(","));
  if (q.genres?.length) p.set("genres", q.genres.join(","));
  if (q.minYear) p.set("from", String(q.minYear));
  if (q.maxYear) p.set("to", String(q.maxYear));
  if (q.maxRuntime) p.set("maxRuntime", String(q.maxRuntime));
  if (q.minRuntime) p.set("minRuntime", String(q.minRuntime));
  if (q.minRating) p.set("minRating", String(q.minRating));
  if (q.region) p.set("region", q.region);
  if (q.availability && q.availability !== "any") p.set("where", q.availability);
  if (q.sort && q.sort !== "recommended") p.set("sort", q.sort);
  if (q.text) p.set("q", q.text);
  return p;
}

/* ───────────── Rule-based natural-language parser ───────────── */

/** Phrases → moods. Order matters only for readability; all matches apply. */
const MOOD_PHRASES: [RegExp, MoodSlug[]][] = [
  [/\b(happy|cheerful|joyful|upbeat|light[- ]?hearted)\b/, ["happy"]],
  [/\b(romantic|romance|love story|date night|rom-?com)\b/, ["romantic"]],
  [/\b(funny|comedy|comedies|hilarious|laugh|silly|witty|rom-?com)\b/, ["funny"]],
  [/\b(emotional|tearjerker|cry|moving|touching|heartfelt)\b/, ["emotional"]],
  [/\b(exciting|thrilling|adrenaline|action[- ]?packed|edge of (my|your) seat)\b/, ["exciting"]],
  [/\b(scary|horror|terrifying|creepy|spooky|frightening)\b/, ["scary"]],
  [/\b(thoughtful|thought[- ]provoking|deep|philosophical|make me think|smart)\b/, ["thoughtful"]],
  [/\b(relaxing|chill|calm|cozy|cosy|easy watch|sunday|unwind|lazy|tired)\b/, ["relaxing"]],
  [/\b(motivat\w*|pump(ed)? up|get up and go|workout)\b/, ["motivating"]],
  [/\b(inspiring|inspirational|uplifting)\b/, ["inspiring"]],
  [/\b(mind[- ]?bending|mind[- ]?blowing|blow my mind|mess(es)? with my (mind|head)|twist(y|s)?|trippy|confusing)\b/, ["mind_bending"]],
  [/\b(dark|bleak|gritty|disturbing|noir)\b/, ["dark"]],
  [/\b(nostalgic|nostalgia|throwback|childhood|retro|old[- ]school)\b/, ["nostalgic"]],
  [/\b(adventur\w*|epic journey|quest|explore)\b/, ["adventurous"]],
  [/\b(comfort(ing)?|wholesome|warm|heartwarming)\b/, ["comforting"]],
  [/\b(hopeful|optimistic)\b/, ["hopeful"]],
  [/\b(intense|gripping|tense|nail[- ]biting)\b/, ["intense"]],
  [/\b(myster(y|ious)|whodunn?it|detective|puzzle)\b/, ["mysterious"]],
  [/\b(feel[- ]?good|pick me up|cheer me up)\b/, ["feel_good"]],
  [/\b(sad|melancholy|melancholic|heartbreaking|depressing)\b/, ["sad"]],
  [/\bthriller\b/, ["intense", "mysterious"]],
];

const GENRE_PHRASES: [RegExp, number][] = [
  [/\bthrillers?\b/, 53],
  [/\bhorror\b/, 27],
  [/\b(sci-?fi|science fiction)\b/, 878],
  [/\banim(e|ated|ation)\b/, 16],
  [/\bdocumentar(y|ies)\b/, 99],
  [/\bwar (movie|film)s?\b/, 10752],
  [/\bwesterns?\b/, 37],
  [/\bcrime\b/, 80],
  [/\bfantasy\b/, 14],
  [/\bmusicals?\b/, 10402],
  [/\b(heist|action)\b/, 28],
  [/\bfamily\b/, 10751],
  [/\bhistor(y|ical)\b/, 36],
  [/\bdrama\b/, 18],
];

/** Demonyms and language names → ISO 639-1 */
const LANG_PHRASES: [RegExp, string][] = [
  [/\b(korean|k-?drama|k-?movie)\b/, "ko"],
  [/\b(japanese|anime)\b/, "ja"],
  [/\b(malayalam|mollywood)\b/, "ml"],
  [/\b(tamil|kollywood)\b/, "ta"],
  [/\b(telugu|tollywood)\b/, "te"],
  [/\b(hindi|bollywood)\b/, "hi"],
  [/\bkannada\b/, "kn"],
  [/\b(bengali|bangla)\b/, "bn"],
  [/\b(chinese|mandarin)\b/, "zh"],
  [/\bcantonese\b/, "cn"],
  [/\b(spanish|mexican|argentin\w*)\b/, "es"],
  [/\bfrench\b/, "fr"],
  [/\bgerman\b/, "de"],
  [/\bitalian\b/, "it"],
  [/\b(portuguese|brazilian)\b/, "pt"],
  [/\bthai\b/, "th"],
  [/\b(turkish)\b/, "tr"],
  [/\b(arabic|egyptian)\b/, "ar"],
  [/\b(persian|iranian|farsi)\b/, "fa"],
  [/\b(swedish)\b/, "sv"],
  [/\b(danish)\b/, "da"],
  [/\b(norwegian)\b/, "no"],
  [/\b(polish)\b/, "pl"],
  [/\b(russian)\b/, "ru"],
  [/\b(indonesian)\b/, "id"],
  [/\b(english|hollywood)\b/, "en"],
];

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, an: 1, a: 1 };

export function parseNaturalLanguage(input: string): DiscoveryQuery {
  const text = input.toLowerCase().replace(/[’']/g, "'");
  const q: DiscoveryQuery = { ...EMPTY_QUERY, moods: [], languages: [], genres: [] };

  const moods = new Set<MoodSlug>();
  for (const [re, ms] of MOOD_PHRASES) if (re.test(text)) ms.forEach((m) => moods.add(m));
  // Bare mood slugs typed directly ("mind_bending")
  for (const slug of MOOD_SLUGS) if (text.includes(slug)) moods.add(slug);
  // "not scary", "nothing sad" → remove
  for (const m of [...moods]) {
    const neg = new RegExp(`\\b(not|no|nothing|without|isn'?t|don'?t want)\\s+(too\\s+)?${m.replace("_", "[- ]?")}`);
    if (neg.test(text)) moods.delete(m);
  }
  q.moods = [...moods].slice(0, 3);

  for (const [re, code] of LANG_PHRASES) if (re.test(text) && !q.languages.includes(code)) q.languages.push(code);
  // "anime" is a format hint too
  if (/\banime\b/.test(text)) q.genres.push(16);
  for (const [re, id] of GENRE_PHRASES) if (re.test(text) && !q.genres.includes(id)) q.genres.push(id);
  // Thriller etc. are already expressed as moods; keep genres only when explicit format words exist.
  q.genres = q.genres.slice(0, 3);

  // Runtime: "under two hours", "less than 90 minutes", "short"
  const hours = text.match(/\b(under|less than|below|shorter than|max(imum)?|within)\s+(\d+(?:\.\d+)?|one|two|three|an?)\s*(hours?|hrs?|h)\b/);
  const mins = text.match(/\b(under|less than|below|shorter than|max(imum)?|within)\s+(\d{2,3})\s*(minutes?|mins?|m)\b/);
  if (hours) q.maxRuntime = Math.round((WORD_NUM[hours[3]] ?? Number(hours[3])) * 60);
  else if (mins) q.maxRuntime = Number(mins[3]);
  else if (/\b(short|quick)\b/.test(text)) q.maxRuntime = 100;
  if (/\b(long|epic|over (two|2|three|3) hours)\b/.test(text)) q.minRuntime = 140;

  // Rating: "rated above 7", "highly rated"
  const rating = text.match(/\b(rated|rating|score)\s*(above|over|at least|>=?|of)?\s*(\d(?:\.\d)?)\b/);
  if (rating) q.minRating = Math.min(9.5, Number(rating[3]));
  else if (/\b(highly rated|critically acclaimed|best|masterpiece|top rated)\b/.test(text)) q.minRating = 7.5;

  // Era: "90s", "from the 80s", "2010s", "after 2015", "before 2000", "recent", "classic"
  const decade = text.match(/\b(?:19|20)?(\d)0'?s\b/);
  const after = text.match(/\b(after|since|newer than)\s+((?:19|20)\d{2})\b/);
  const before = text.match(/\b(before|older than|pre)[- ]?((?:19|20)\d{2})\b/);
  const exactDecade = text.match(/\b((?:19|20)\d)0'?s\b/);
  if (exactDecade) {
    q.minYear = Number(exactDecade[1] + "0");
    q.maxYear = q.minYear + 9;
  } else if (decade) {
    const d = Number(decade[1]);
    q.minYear = d >= 3 ? 1900 + d * 10 : 2000 + d * 10;
    q.maxYear = q.minYear + 9;
  }
  if (after) q.minYear = Number(after[2]);
  if (before) q.maxYear = Number(before[2]);
  if (/\b(recent|new|latest|this year)\b/.test(text) && !q.minYear) q.minYear = new Date().getFullYear() - 3;
  if (/\b(classic|old)\b/.test(text) && !q.maxYear) q.maxYear = 1995;

  if (/\b(streaming|on netflix|on prime|to stream)\b/.test(text)) q.availability = "stream";

  // Anything with no structured signal is treated as a title/person/keyword search.
  const structured = q.moods.length + q.languages.length + q.genres.length + (q.maxRuntime ? 1 : 0) + (q.minYear ? 1 : 0);
  q.text = structured === 0 ? input.trim().slice(0, 200) : null;
  return q;
}

/** Normalize a query string for caching AI interpretations. */
export const normalizeForCache = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
