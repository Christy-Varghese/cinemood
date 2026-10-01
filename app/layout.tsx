import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { MoodsProvider, themeScript } from "@/components/providers/Providers";
import { BottomNav, SiteHeader } from "@/components/navigation/Nav";
import { LibrarySync } from "@/components/library/LibrarySync";
import { getMoods } from "@/lib/db/repository";
import { t } from "@/lib/i18n";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "CineMood — Find a movie for how you feel", template: "%s · CineMood" },
  description: "Tell us how you feel. We'll find the movie. Mood-first movie discovery across every language and country.",
  applicationName: "CineMood",
  openGraph: { type: "website", siteName: "CineMood", title: "CineMood — Find a movie for how you feel", description: "Mood-first movie discovery across every language and country." },
  twitter: { card: "summary_large_image", title: "CineMood", description: "Your mood. Your movie." },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0e15" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4f8" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const moods = await getMoods();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&family=Manrope:wght@400..800&display=swap"
        />
        <link rel="preconnect" href="https://image.tmdb.org" />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <MoodsProvider moods={moods}>
          <SiteHeader />
          <main id="main">
            <Suspense>{children}</Suspense>
          </main>
          <footer className="site-footer">
            <div className="container">
              <div className="tmdb-credit">
                <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: "var(--text-2)" }}>
                  Data &amp; images: TMDB
                </a>
                <span>
                  {t.footer.tmdb} {t.footer.justwatch} Extra ratings from OMDb (CC BY-NC 4.0), community data from Trakt, awards from Wikidata.
                </span>
              </div>
              <nav aria-label="Footer">
                <Link href="/about">About</Link>
                <Link href="/moods">Moods</Link>
                <Link href="/languages">Languages</Link>
                <Link href="/surprise">Surprise me</Link>
              </nav>
            </div>
          </footer>
          <BottomNav />
          <LibrarySync />
        </MoodsProvider>
      </body>
    </html>
  );
}
