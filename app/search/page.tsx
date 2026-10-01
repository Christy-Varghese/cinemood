import type { Metadata } from "next";
import { SearchView } from "@/components/search/SearchView";

export const metadata: Metadata = { title: "Search", description: "Describe what you feel like watching, or search titles, actors and directors.", alternates: { canonical: "/search" } };

export default function SearchPage() {
  return <SearchView />;
}
