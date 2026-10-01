/** TMDB image CDN helpers — safe for client components (no secrets). */
export const IMG = {
  poster: (p: string | null, size: "w185" | "w342" | "w500" | "w780" = "w342") =>
    p ? `https://image.tmdb.org/t/p/${size}${p}` : null,
  backdrop: (p: string | null, size: "w780" | "w1280" | "original" = "w1280") =>
    p ? `https://image.tmdb.org/t/p/${size}${p}` : null,
  profile: (p: string | null, size: "w185" | "h632" = "w185") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null),
  logo: (p: string | null) => (p ? `https://image.tmdb.org/t/p/w92${p}` : null),
};
