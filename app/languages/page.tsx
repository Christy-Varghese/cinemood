import Link from "next/link";
import type { Metadata } from "next";
import { LANGUAGES, languageSlug } from "@/lib/reference";

export const metadata: Metadata = {
  title: "Languages",
  description: "Movies in Malayalam, Korean, Japanese, Spanish, French, Hindi, Tamil and more.",
  alternates: { canonical: "/languages" },
};

export default function LanguagesPage() {
  const regions = [...new Set(LANGUAGES.map((l) => l.region))];
  return (
    <div className="container">
      <header className="page-head">
        <h1>Cinema in every language</h1>
        <p>Pick a language to see what&apos;s popular, new, top rated and quietly brilliant.</p>
      </header>
      {regions.map((r) => (
        <section className="section" key={r} aria-labelledby={`r-${r}`}>
          <div className="section-head">
            <h2 id={`r-${r}`} style={{ fontSize: "1.3rem" }}>
              {r}
            </h2>
          </div>
          <div className="lang-grid">
            {LANGUAGES.filter((l) => l.region === r).map((l) => (
              <Link key={l.code} href={`/language/${languageSlug(l.code)}`} className="lang-card">
                <span className="native" lang={l.code}>
                  {l.nativeName}
                </span>
                <span className="en">{l.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
