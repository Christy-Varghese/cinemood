import type { Metadata } from "next";
import { AuthForm } from "@/components/library/AuthForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function AuthPage() {
  return (
    <div className="container">
      <header className="page-head" style={{ textAlign: "center" }}>
        <h1>Welcome to CineMood</h1>
        <p style={{ marginInline: "auto" }}>Sync your watchlist and watched history everywhere you watch.</p>
      </header>
      <div className="section" style={{ marginTop: 32 }}>
        <AuthForm />
      </div>
    </div>
  );
}
