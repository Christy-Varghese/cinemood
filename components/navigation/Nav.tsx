"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Logo, type IconName } from "@/components/ui/Icon";
import { useTheme } from "@/components/providers/Providers";
import { useLibrary } from "@/lib/library/store";
import { t } from "@/lib/i18n";

const DESKTOP = [
  { href: "/explore", label: t.nav.explore },
  { href: "/swipe", label: t.nav.swipe },
  { href: "/discover", label: t.nav.discover },
  { href: "/moods", label: t.nav.moods },
  { href: "/trending", label: t.nav.trending },
  { href: "/season", label: "Seasonal" },
  { href: "/upcoming", label: "Upcoming" },
];

const MOBILE: { href: string; label: string; icon: IconName; match?: string[] }[] = [
  { href: "/", label: t.nav.home, icon: "home" },
  { href: "/explore", label: t.nav.explore, icon: "compass", match: ["/explore", "/discover", "/moods", "/mood", "/languages", "/language", "/trending", "/genre", "/movies", "/season", "/revival", "/upcoming"] },
  { href: "/swipe", label: t.nav.swipe, icon: "cards" },
  { href: "/watchlist", label: t.nav.watchlist, icon: "bookmark", match: ["/watchlist", "/watched", "/favorites"] },
  { href: "/profile", label: t.nav.profile, icon: "user", match: ["/profile", "/auth"] },
];

const isActive = (path: string, href: string, match?: string[]) =>
  href === "/" ? path === "/" : (match ?? [href]).some((m) => path === m || path.startsWith(m + "/"));

export function SiteHeader() {
  const path = usePathname();
  const lib = useLibrary();
  const [theme, setTheme] = useTheme();
  const want = Object.values(lib.items).filter((i) => i.status === "want").length;
  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => setSystemLight(window.matchMedia("(prefers-color-scheme: light)").matches), []);
  const effective = theme === "system" ? (systemLight ? "light" : "dark") : theme;
  const nextTheme = effective === "light" ? "dark" : "light";

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="logo" aria-label="CineMood home">
          <Logo />
          <span>CineMood</span>
        </Link>
        <nav className="main-nav" aria-label="Primary">
          {DESKTOP.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="header-link" href="/watchlist" aria-current={isActive(path, "/watchlist") ? "page" : undefined}>
            {t.nav.watchlist}
          </Link>
          <Link className="header-link" href="/watched" aria-current={isActive(path, "/watched") ? "page" : undefined}>
            {t.nav.watched}
          </Link>
          <Link className="icon-btn" href="/search" aria-label={t.nav.search}>
            <Icon name="search" />
          </Link>
          <Link className="icon-btn" href="/surprise" aria-label={t.nav.surprise} title={t.nav.surprise}>
            <Icon name="dice" />
          </Link>
          <Link className="icon-btn hide-desktop" href="/watchlist" aria-label={`${t.nav.watchlist} (${want})`}>
            <Icon name="bookmark" />
            {want > 0 && <span className="badge">{want > 99 ? "99+" : want}</span>}
          </Link>
          <button className="icon-btn" onClick={() => setTheme(nextTheme)} aria-label={`Switch to ${nextTheme} theme`}>
            <Icon name={effective === "light" ? "moon" : "sun"} />
          </button>
          <Link className="icon-btn hide-mobile" href="/profile" aria-label={t.nav.profile}>
            <Icon name="user" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Primary mobile">
      {MOBILE.map((l) => {
        const active = isActive(path, l.href, l.match);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            <Icon name={l.icon} size={22} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
