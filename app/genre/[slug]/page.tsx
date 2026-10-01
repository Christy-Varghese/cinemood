import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ResultsView } from "@/components/discover/ResultsView";
import { GENRES } from "@/lib/reference";

export function generateStaticParams() {
  return GENRES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GENRES.find((x) => x.slug === slug);
  if (!g) return { title: "Genre not found" };
  return { title: `${g.name} movies`, description: `${g.name} movies from around the world, sorted by mood.`, alternates: { canonical: `/genre/${g.slug}` } };
}

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GENRES.find((x) => x.slug === slug);
  if (!g) notFound();
  return <ResultsView preset={{ genres: [g.id] }} heading={`${g.name} movies`} subheading="Add a mood to steer the results — genre is only the starting point." />;
}
