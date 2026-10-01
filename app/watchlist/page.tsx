import type { Metadata } from "next";
import { LibraryView } from "@/components/library/LibraryView";

export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <LibraryView tab={view === "all" ? "all" : "watchlist"} />;
}
