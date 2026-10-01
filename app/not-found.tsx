import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <div className="container">
      <EmptyState icon="🎬" title="We couldn't find that page." body="It may have moved, or the movie isn't in TMDB." cta={{ href: "/", label: "Find a movie" }} />
    </div>
  );
}
