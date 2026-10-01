import "server-only";
import { TmdbNotConfiguredError } from "@/lib/tmdb/client";
import { logError } from "@/lib/logger";

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "config" | "error" };

/** Wrap a server-side data load so pages can render a friendly state instead of crashing. */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof TmdbNotConfiguredError) return { ok: false, reason: "config" };
    logError("tmdb", "page data load failed", e);
    return { ok: false, reason: "error" };
  }
}

/** Settle many loads; any config error short-circuits to "config". */
export async function loadAll<T extends Record<string, () => Promise<unknown>>>(fns: T): Promise<Loaded<{ [K in keyof T]: Awaited<ReturnType<T[K]>> | null }>> {
  const keys = Object.keys(fns) as (keyof T)[];
  const settled = await Promise.allSettled(keys.map((k) => fns[k]()));
  if (settled.some((s) => s.status === "rejected" && s.reason instanceof TmdbNotConfiguredError)) return { ok: false, reason: "config" };
  if (settled.every((s) => s.status === "rejected")) {
    logError("tmdb", "all page loads failed", (settled[0] as PromiseRejectedResult).reason);
    return { ok: false, reason: "error" };
  }
  const data = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  keys.forEach((k, i) => {
    const s = settled[i];
    data[k] = (s.status === "fulfilled" ? s.value : null) as Awaited<ReturnType<T[typeof k]>> | null;
  });
  return { ok: true, data };
}
