import Image from "next/image";
import { IMG } from "@/lib/tmdb/images";

export function Poster({ path, title, size = "w342", priority = false, sizes }: { path: string | null; title: string; size?: "w185" | "w342" | "w500" | "w780"; priority?: boolean; sizes?: string }) {
  const src = IMG.poster(path, size);
  if (!src) {
    return (
      <span className="poster-fallback" aria-hidden="true">
        {title}
      </span>
    );
  }
  return <Image src={src} alt={`Poster for ${title}`} fill sizes={sizes ?? "(max-width: 560px) 45vw, 190px"} priority={priority} />;
}
