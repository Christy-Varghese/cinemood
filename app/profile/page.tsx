import type { Metadata } from "next";
import { ProfileView } from "@/components/library/ProfileView";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default function ProfilePage() {
  return <ProfileView />;
}
