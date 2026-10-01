import "server-only";
import { env, isTmdbConfigured } from "@/lib/env";
import { logError } from "@/lib/logger";

/** Thrown when TMDB credentials are missing — pages show a setup notice instead of fake data. */
export class TmdbNotConfiguredError extends Error {
  constructor() {
    super("TMDB_API_KEY is not set");
    this.name = "TmdbNotConfiguredError";
  }
}

export class TmdbError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Server-side TMDB fetcher. The key is attached here and never reaches the browser.
 * Responses are cached by Next's data cache (`revalidate`), so pages don't hit
 * TMDB on every render.
 */
export async function tmdb<T>(path: string, params: Params = {}, revalidate = 60 * 60 * 6): Promise<T> {
  if (!isTmdbConfigured()) throw new TmdbNotConfiguredError();

  const url = new URL(`${env.tmdbBase}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  // v4 read-access tokens are JWTs; v3 keys are 32-char hex.
  if (env.tmdbKey.startsWith("eyJ")) headers.Authorization = `Bearer ${env.tmdbKey}`;
  else url.searchParams.set("api_key", env.tmdbKey);

  let res: Response;
  try {
    res = await fetch(url, { headers, next: { revalidate, tags: ["tmdb"] } });
  } catch (e) {
    logError("tmdb", `Network error for ${path}`, e);
    throw new TmdbError("TMDB unreachable", 503);
  }
  if (!res.ok) {
    logError("tmdb", `TMDB ${res.status} for ${path}`);
    throw new TmdbError(`TMDB responded ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}
