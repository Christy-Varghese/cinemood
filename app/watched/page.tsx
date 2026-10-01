import type { Metadata } from "next";
import { LibraryView } from "@/components/library/LibraryView";

export const metadata: Metadata = { title: "Watched", robots: { index: false } };

export default function WatchedPage() {
  return <LibraryView tab="watched" />;
}
