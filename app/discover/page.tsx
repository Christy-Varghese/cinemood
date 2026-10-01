import type { Metadata } from "next";
import { ResultsView } from "@/components/discover/ResultsView";

export const metadata: Metadata = {
  title: "Discover",
  description: "Movies matched to your mood, ranked by the CineMood mood engine.",
  alternates: { canonical: "/discover" },
};

export default function DiscoverPage() {
  return <ResultsView />;
}
