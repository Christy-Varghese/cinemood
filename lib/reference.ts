/**
 * Reference data that mirrors TMDB's own configuration endpoints.
 * Used for filters, onboarding, and seeding. Live TMDB genre names are
 * still fetched at runtime for display.
 */

export interface LanguageInfo {
  code: string; // ISO 639-1, as used by TMDB original_language
  name: string;
  nativeName: string;
  region: string;
  /** A representative production country — a discovery hint only, never assumed to equal the language. */
  hintCountry: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English", region: "Global", hintCountry: "US" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", region: "South Asia", hintCountry: "IN" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", region: "South Asia", hintCountry: "IN" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", region: "South Asia", hintCountry: "IN" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", region: "South Asia", hintCountry: "IN" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", region: "South Asia", hintCountry: "IN" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", region: "South Asia", hintCountry: "IN" },
  { code: "ko", name: "Korean", nativeName: "한국어", region: "East Asia", hintCountry: "KR" },
  { code: "ja", name: "Japanese", nativeName: "日本語", region: "East Asia", hintCountry: "JP" },
  { code: "zh", name: "Chinese", nativeName: "中文", region: "East Asia", hintCountry: "CN" },
  { code: "cn", name: "Cantonese", nativeName: "廣東話", region: "East Asia", hintCountry: "HK" },
  { code: "th", name: "Thai", nativeName: "ไทย", region: "Southeast Asia", hintCountry: "TH" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", region: "Southeast Asia", hintCountry: "ID" },
  { code: "tl", name: "Filipino", nativeName: "Filipino", region: "Southeast Asia", hintCountry: "PH" },
  { code: "es", name: "Spanish", nativeName: "Español", region: "Europe & Americas", hintCountry: "ES" },
  { code: "fr", name: "French", nativeName: "Français", region: "Europe", hintCountry: "FR" },
  { code: "de", name: "German", nativeName: "Deutsch", region: "Europe", hintCountry: "DE" },
  { code: "it", name: "Italian", nativeName: "Italiano", region: "Europe", hintCountry: "IT" },
  { code: "pt", name: "Portuguese", nativeName: "Português", region: "Europe & Americas", hintCountry: "BR" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", region: "Europe", hintCountry: "SE" },
  { code: "da", name: "Danish", nativeName: "Dansk", region: "Europe", hintCountry: "DK" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", region: "Europe", hintCountry: "NO" },
  { code: "pl", name: "Polish", nativeName: "Polski", region: "Europe", hintCountry: "PL" },
  { code: "ru", name: "Russian", nativeName: "Русский", region: "Europe", hintCountry: "RU" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", region: "Middle East", hintCountry: "TR" },
  { code: "ar", name: "Arabic", nativeName: "العربية", region: "Middle East", hintCountry: "EG" },
  { code: "fa", name: "Persian", nativeName: "فارسی", region: "Middle East", hintCountry: "IR" },
  { code: "he", name: "Hebrew", nativeName: "עברית", region: "Middle East", hintCountry: "IL" },
];

export const languageName = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();

/** Language slugs for SEO URLs: /language/malayalam ⇄ ml */
export const languageSlug = (code: string) =>
  (LANGUAGES.find((l) => l.code === code)?.name ?? code).toLowerCase();
export const languageFromSlug = (slug: string) =>
  LANGUAGES.find((l) => l.name.toLowerCase() === slug.toLowerCase() || l.code === slug.toLowerCase());

/** TMDB movie genre ids — stable across TMDB's API. */
export const GENRES: { id: number; name: string; slug: string }[] = [
  { id: 28, name: "Action", slug: "action" },
  { id: 12, name: "Adventure", slug: "adventure" },
  { id: 16, name: "Animation", slug: "animation" },
  { id: 35, name: "Comedy", slug: "comedy" },
  { id: 80, name: "Crime", slug: "crime" },
  { id: 99, name: "Documentary", slug: "documentary" },
  { id: 18, name: "Drama", slug: "drama" },
  { id: 10751, name: "Family", slug: "family" },
  { id: 14, name: "Fantasy", slug: "fantasy" },
  { id: 36, name: "History", slug: "history" },
  { id: 27, name: "Horror", slug: "horror" },
  { id: 10402, name: "Music", slug: "music" },
  { id: 9648, name: "Mystery", slug: "mystery" },
  { id: 10749, name: "Romance", slug: "romance" },
  { id: 878, name: "Science Fiction", slug: "science-fiction" },
  { id: 10770, name: "TV Movie", slug: "tv-movie" },
  { id: 53, name: "Thriller", slug: "thriller" },
  { id: 10752, name: "War", slug: "war" },
  { id: 37, name: "Western", slug: "western" },
];

export const genreName = (id: number) => GENRES.find((g) => g.id === id)?.name ?? "Other";

export const REGIONS: { code: string; name: string }[] = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "BR", name: "Brazil" },
];
