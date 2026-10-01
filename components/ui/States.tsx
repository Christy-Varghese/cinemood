import Link from "next/link";
import { t } from "@/lib/i18n";

export function ConfigNotice({ what = "tmdb" }: { what?: "tmdb" | "supabase" }) {
  if (what === "supabase") {
    return (
      <div className="state" role="status">
        <div className="state-icon" aria-hidden>
          🔐
        </div>
        <h2>Accounts need Supabase</h2>
        <p>
          Sign-in, cross-device sync and the admin dashboard use Supabase. Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code>, then run the migrations in <code>supabase/migrations</code>.
        </p>
        <p>Your watchlist still works without an account — it&apos;s saved on this device.</p>
      </div>
    );
  }
  return (
    <div className="state" role="status">
      <div className="state-icon" aria-hidden>
        🎞️
      </div>
      <h2>{t.errors.configTitle}</h2>
      <p>{t.errors.configBody}</p>
      <a className="btn btn-outline" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
        Get a TMDB key
      </a>
    </div>
  );
}

export function ErrorState({ title = t.errors.load, retryHref, onRetry }: { title?: string; retryHref?: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="state-icon" aria-hidden>
        📡
      </div>
      <h2>{title}</h2>
      <p>The movie service didn&apos;t respond. Check your connection and try again.</p>
      {onRetry ? (
        <button className="btn btn-ghost" onClick={onRetry}>
          {t.errors.retry}
        </button>
      ) : retryHref ? (
        <a className="btn btn-ghost" href={retryHref}>
          {t.errors.retry}
        </a>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, cta }: { icon: string; title: string; body?: string; cta?: { href: string; label: string } }) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden>
        {icon}
      </div>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {cta && (
        <Link className="btn btn-primary" href={cta.href}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading movies">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton sk-poster" />
          <div className="skeleton sk-line" style={{ width: "80%" }} />
          <div className="skeleton sk-line" style={{ width: "50%" }} />
        </div>
      ))}
    </div>
  );
}

export function RailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="rail" aria-busy="true" aria-label="Loading movies">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton sk-poster" />
          <div className="skeleton sk-line" style={{ width: "75%" }} />
        </div>
      ))}
    </div>
  );
}
