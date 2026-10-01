"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Browser client — anon key only (RLS enforced). Returns null when Supabase isn't configured. */
let client: SupabaseClient | null | undefined;
export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anon ? createBrowserClient(url, anon) : null;
  return client;
}
