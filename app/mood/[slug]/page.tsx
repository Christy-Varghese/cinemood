import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ResultsView } from "@/components/discover/ResultsView";
import { getMoods } from "@/lib/db/repository";
import { moodFromUrl, moodToUrl, MOOD_SEED } from "@/lib/moods/taxonomy";

export function generateStaticParams() {
  return MOOD_SEED.map((m) => ({ slug: moodToUrl(m.slug) }));
}

async function findMood(slug: string) {
  const moods = await getMoods();
  return moods.find((m) => m.slug === moodFromUrl(slug));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const mood = await findMood((await params).slug);
  if (!mood) return { title: "Mood not found" };
  return {
    title: `${mood.name} movies`,
    description: `${mood.tagline} ${mood.description} Ranked by mood, from every language.`,
    alternates: { canonical: `/mood/${moodToUrl(mood.slug)}` },
    openGraph: { title: `${mood.name} movies · CineMood`, description: mood.tagline },
  };
}

export default async function MoodPage({ params }: { params: Promise<{ slug: string }> }) {
  const mood = await findMood((await params).slug);
  if (!mood) notFound();
  return <ResultsView preset={{ moods: [mood.slug] }} heading={`${mood.icon} ${mood.name} movies`} subheading={mood.tagline} />;
}
