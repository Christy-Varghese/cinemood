import type { Metadata } from "next";
import { SurpriseView } from "@/components/surprise/SurpriseView";
import { getFlags } from "@/lib/db/repository";
import { EmptyState } from "@/components/ui/States";

export const revalidate = 300;
export const metadata: Metadata = { title: "Surprise me", description: "One carefully picked movie for your mood.", alternates: { canonical: "/surprise" } };

export default async function SurprisePage() {
  const flags = await getFlags();
  if (!flags.SURPRISE_ME) return <div className="container"><EmptyState icon="🎲" title="Surprise Me is switched off" body="An admin has paused this feature." /></div>;
  return <SurpriseView />;
}
