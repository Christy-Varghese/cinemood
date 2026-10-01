import "server-only";
import { headers } from "next/headers";
import { logInfo } from "@/lib/logger";

/**
 * In-memory sliding-window rate limiter keyed by client IP + bucket.
 * Good for a single instance; swap for Upstash/Redis when horizontally scaled.
 */
const hits = new Map<string, number[]>();

export const LIMITS = {
  search: { max: 30, windowMs: 60_000 },
  ai: { max: 10, windowMs: 60_000 },
  recommend: { max: 40, windowMs: 60_000 },
  events: { max: 120, windowMs: 60_000 },
  auth: { max: 10, windowMs: 60_000 },
  admin: { max: 30, windowMs: 60_000 },
} as const;

export async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function rateLimit(bucket: keyof typeof LIMITS): Promise<{ ok: boolean; retryAfter: number }> {
  const { max, windowMs } = LIMITS[bucket];
  const key = `${bucket}:${await clientKey()}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    logInfo("rate-limit", `limited ${bucket}`, { key });
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - list[0])) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) hits.clear();
  return { ok: true, retryAfter: 0 };
}
