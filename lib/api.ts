import "server-only";
import { NextResponse } from "next/server";
import { TmdbError, TmdbNotConfiguredError } from "@/lib/tmdb/client";
import { logError } from "@/lib/logger";

/** Uniform API error responses — friendly message, no stack traces. */
export function apiError(e: unknown, area: Parameters<typeof logError>[0] = "tmdb") {
  if (e instanceof TmdbNotConfiguredError) {
    return NextResponse.json({ error: "not_configured", message: "Movie data needs a TMDB_API_KEY on the server." }, { status: 503 });
  }
  if (e instanceof TmdbError && e.status === 404) {
    return NextResponse.json({ error: "not_found", message: "We couldn't find that movie." }, { status: 404 });
  }
  logError(area, "API request failed", e);
  return NextResponse.json({ error: "unavailable", message: "We couldn't load movies right now." }, { status: 502 });
}

export const tooMany = (retryAfter: number) =>
  NextResponse.json({ error: "rate_limited", message: "Slow down a little — try again in a moment." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

export const badRequest = (message = "Invalid request") => NextResponse.json({ error: "bad_request", message }, { status: 400 });

/** Same-origin check for state-changing requests (CSRF defence in depth; cookies are SameSite=Lax). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser / same-origin navigations
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export const parseId = (raw: string) => {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 && id < 1e9 ? id : null;
};
