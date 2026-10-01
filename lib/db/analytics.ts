import "server-only";
import { supabaseAdmin } from "./supabase";
import { errorCounts } from "@/lib/logger";

/** Admin dashboard data — reads aggregate views defined in the migrations. */
export async function getAdminOverview() {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const [overview, daily, moods, langs, searches, skipped, clicked, jobs] = await Promise.all([
    sb.from("admin_overview").select("*").maybeSingle(),
    sb.from("analytics_daily").select("*").order("day", { ascending: false }).limit(30),
    sb.from("analytics_top_moods").select("*").limit(12),
    sb.from("analytics_top_languages").select("*").limit(12),
    sb.from("analytics_top_searches").select("*").limit(15),
    sb.from("analytics_most_skipped").select("*").limit(10),
    sb.from("analytics_ctr").select("*").maybeSingle(),
    sb.from("jobs").select("id, type, status, payload, result, created_at, finished_at").order("created_at", { ascending: false }).limit(15),
  ]);
  return {
    overview: overview.data ?? {},
    daily: (daily.data ?? []).reverse(),
    topMoods: moods.data ?? [],
    topLanguages: langs.data ?? [],
    topSearches: searches.data ?? [],
    mostSkipped: skipped.data ?? [],
    ctr: clicked.data ?? null,
    jobs: jobs.data ?? [],
    apiErrors: errorCounts(),
  };
}
