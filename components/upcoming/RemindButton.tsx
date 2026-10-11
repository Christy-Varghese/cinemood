"use client";

import { Icon } from "@/components/ui/Icon";
import { library, useLibrary, type MovieLite } from "@/lib/library/store";

/** Save an upcoming film to the watchlist so it's waiting there on release day. */
export function RemindButton({ movie }: { movie: MovieLite }) {
  const lib = useLibrary();
  const saved = !!lib.items[movie.tmdbId];
  return (
    <button
      type="button"
      className={`btn ${saved ? "btn-ghost is-on" : "btn-outline"} btn-sm`}
      aria-pressed={saved}
      onClick={() => (saved ? library.remove(movie.tmdbId) : library.save(movie, "want"))}
    >
      <Icon name={saved ? "check" : "bookmark"} size={16} /> {saved ? "On your watchlist" : "Add to watchlist"}
    </button>
  );
}
