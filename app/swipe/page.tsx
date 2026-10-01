import type { Metadata } from "next";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

export const metadata: Metadata = {
  title: "Swipe",
  description: "Swipe through movie picks matched to your mood — right for your watchlist, left to skip.",
  alternates: { canonical: "/swipe" },
};

export default function SwipePage() {
  return <SwipeDeck />;
}
