import "server-only";

/** Centralised server-side env access. Nothing here is ever sent to the browser. */
export const env = {
  tmdbKey: process.env.TMDB_API_KEY?.trim() || "",
  tmdbBase: (process.env.TMDB_BASE_URL?.trim() || "https://api.themoviedb.org/3").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  supabaseAnon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  ollamaUrl: (process.env.OLLAMA_URL?.trim() || "").replace(/\/$/, ""),
  ollamaModel: process.env.OLLAMA_MODEL?.trim() || "gemma3:4b",
  omdbKey: process.env.OMDB_API_KEY?.trim() || "",
  traktClientId: process.env.TRAKT_CLIENT_ID?.trim() || "",
  defaultRegion: (process.env.DEFAULT_REGION?.trim() || "CA").toUpperCase(),
  appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
};

export const isTmdbConfigured = () => env.tmdbKey.length > 0;
export const isSupabaseConfigured = () => env.supabaseUrl.length > 0 && env.supabaseAnon.length > 0;
export const isAiConfigured = () => env.ollamaUrl.length > 0;
export const isOmdbConfigured = () => env.omdbKey.length > 0;
export const isTraktConfigured = () => env.traktClientId.length > 0;
