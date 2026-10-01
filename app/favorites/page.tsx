import type { Metadata } from "next";
import { LibraryView } from "@/components/library/LibraryView";

export const metadata: Metadata = { title: "Favorites", robots: { index: false } };

export default function FavoritesPage() {
  return <LibraryView tab="favorites" />;
}
