import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/** Per-request client bound to the user's auth cookies (respects RLS). */
export async function supabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component — cookie refresh happens in route handlers instead.
        }
      },
    },
  });
}

/**
 * Service-role client for trusted server jobs (sync, mood generation, admin).
 * NEVER import this from client components; the key bypasses RLS.
 */
let admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseService) return null;
  admin ??= createClient(env.supabaseUrl, env.supabaseService, { auth: { persistSession: false } });
  return admin;
}

export async function getSessionUser() {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export type AdminRole = "super_admin" | "admin" | "editor" | "moderator";

/** Server-side admin check — the UI hides admin links, but this is the real gate. */
export async function getAdminRole(): Promise<AdminRole | null> {
  const user = await getSessionUser();
  const sb = supabaseAdmin();
  if (!user || !sb) return null;
  const { data } = await sb.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  return (data?.role as AdminRole) ?? null;
}
