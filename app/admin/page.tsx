import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { ConfigNotice, EmptyState } from "@/components/ui/States";
import { getAdminRole, getSessionUser, supabaseAdmin } from "@/lib/db/supabase";
import { getActiveWeights, getFlags, getMoods } from "@/lib/db/repository";
import { getAdminOverview } from "@/lib/db/analytics";
import { isSupabaseConfigured } from "@/lib/env";
import { languageName } from "@/lib/reference";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Bars({ rows, label, value }: { rows: Record<string, unknown>[]; label: string; value: string }) {
  if (!rows.length) return <p className="muted-note">No data yet.</p>;
  const max = Math.max(1, ...rows.map((r) => Number(r[value]) || 0));
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div key={i}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r[label])}</span>
          <i style={{ width: `${(Number(r[value]) / max) * 100}%` }} />
          <strong style={{ textAlign: "right" }}>{String(r[value])}</strong>
        </div>
      ))}
    </div>
  );
}

export default async function AdminPage() {
  if (!isSupabaseConfigured() || !supabaseAdmin()) {
    return (
      <div className="container">
        <ConfigNotice what="supabase" />
      </div>
    );
  }
  const user = await getSessionUser();
  const role = await getAdminRole();
  if (!user || !role) {
    return (
      <div className="container">
        <EmptyState
          icon="🔒"
          title={user ? "You don't have admin access" : "Sign in as an admin"}
          body="Admins are listed in the admin_users table. A super admin can grant access with: insert into admin_users (user_id, role) values ('<user uuid>', 'admin');"
          cta={user ? undefined : { href: "/auth", label: "Sign in" }}
        />
      </div>
    );
  }

  const [data, weights, flags, moods, moodStats, users] = await Promise.all([
    getAdminOverview(),
    getActiveWeights(),
    getFlags(),
    getMoods(),
    supabaseAdmin()!.from("admin_mood_stats").select("*"),
    supabaseAdmin()!.from("admin_user_summary").select("*").order("created_at", { ascending: false }).limit(25),
  ]);
  const o = (data?.overview ?? {}) as Record<string, number>;
  const tiles: [string, number | string][] = [
    ["Total movies", o.total_movies ?? 0],
    ["Added this week", o.movies_this_week ?? 0],
    ["With mood profiles", o.movies_with_moods ?? 0],
    ["Pending classification", o.pending_moods ?? 0],
    ["Users", o.users ?? 0],
    ["Active users (7d)", o.active_users_7d ?? 0],
    ["Recommendations served", o.recommendations ?? 0],
    ["API errors (this instance)", Object.values(data?.apiErrors ?? {}).reduce((a, b) => a + b, 0)],
  ];
  const ctr = data?.ctr as { impressions?: number; clicks?: number; saves?: number } | null;

  return (
    <div className="container">
      <header className="page-head">
        <h1>Admin</h1>
        <p>
          Signed in as {user.email} · role <code>{role}</code>
        </p>
      </header>

      <section className="section admin-grid" aria-label="Overview">
        {tiles.map(([k, v]) => (
          <div className="stat-tile" key={k}>
            <span>{k}</span>
            <strong>{typeof v === "number" ? v.toLocaleString("en") : v}</strong>
          </div>
        ))}
      </section>

      <section className="section" style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="panel">
          <h2>Most requested moods</h2>
          <Bars rows={(data?.topMoods ?? []) as Record<string, unknown>[]} label="mood" value="count" />
        </div>
        <div className="panel">
          <h2>Top languages</h2>
          <Bars rows={((data?.topLanguages ?? []) as { language: string; count: number }[]).map((r) => ({ ...r, language: languageName(r.language) }))} label="language" value="count" />
        </div>
        <div className="panel">
          <h2>Recommendation funnel</h2>
          <dl className="facts">
            <div>
              <dt>Impressions logged</dt>
              <dd>{(ctr?.impressions ?? 0).toLocaleString("en")}</dd>
            </div>
            <div>
              <dt>Click-through rate</dt>
              <dd>{ctr?.impressions ? `${(((ctr.clicks ?? 0) / ctr.impressions) * 100).toFixed(1)}%` : "—"}</dd>
            </div>
            <div>
              <dt>Watchlist conversion</dt>
              <dd>{ctr?.clicks ? `${(((ctr.saves ?? 0) / ctr.clicks) * 100).toFixed(1)}%` : "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="panel">
          <h2>Daily activity (30d)</h2>
          <Bars rows={((data?.daily ?? []) as Record<string, unknown>[]).slice(-10)} label="day" value="active_users" />
        </div>
        <div className="panel">
          <h2>Top searches</h2>
          <Bars rows={(data?.topSearches ?? []) as Record<string, unknown>[]} label="query" value="count" />
        </div>
        <div className="panel">
          <h2>Most skipped</h2>
          <Bars rows={(data?.mostSkipped ?? []) as Record<string, unknown>[]} label="tmdb_id" value="count" />
        </div>
      </section>

      <section className="section panel" aria-labelledby="engine">
        <h2 id="engine">Mood engine</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Mood</th>
                <th>Movies classified</th>
                <th>Avg score</th>
                <th>Avg confidence</th>
                <th>Last updated</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {(moodStats.data ?? []).map((r) => (
                <tr key={r.slug}>
                  <td>
                    {r.icon} {r.name}
                  </td>
                  <td>{r.movies}</td>
                  <td>{r.avg_score ? Number(r.avg_score).toFixed(2) : "—"}</td>
                  <td>{r.avg_confidence ? Number(r.avg_confidence).toFixed(2) : "—"}</td>
                  <td>{r.last_updated ? new Date(r.last_updated).toLocaleDateString() : "—"}</td>
                  <td>
                    <code>{r.model_version ?? "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <AdminConsole weights={weights} flags={flags} moods={moods} role={role} />
      </section>

      <section className="section panel" aria-labelledby="jobs">
        <h2 id="jobs">Background jobs</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Payload</th>
                <th>Result</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {((data?.jobs ?? []) as { id: string; type: string; status: string; payload: unknown; result: unknown; created_at: string }[]).map((j) => (
                <tr key={j.id}>
                  <td>{j.type}</td>
                  <td>{j.status}</td>
                  <td>
                    <code>{JSON.stringify(j.payload)}</code>
                  </td>
                  <td>
                    <code>{JSON.stringify(j.result)}</code>
                  </td>
                  <td>{new Date(j.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section panel" aria-labelledby="users">
        <h2 id="users">Users</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Created</th>
                <th>Last active</th>
                <th>Watchlist</th>
                <th>Interactions</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name ?? u.email}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>{u.last_active ? new Date(u.last_active).toLocaleDateString() : "—"}</td>
                  <td>{u.watchlist_count}</td>
                  <td>{u.interactions}</td>
                  <td>{u.is_suspended ? "Suspended" : "Active"}</td>
                  <td>{u.role ?? "user"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
