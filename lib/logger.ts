/**
 * Structured server logging. Technical details stay in server logs —
 * users only ever see friendly copy.
 */
type Area = "tmdb" | "ai" | "db" | "auth" | "recommendations" | "rate-limit" | "events" | "admin";

const counters: Record<string, number> = {};

export function logError(area: Area, message: string, detail?: unknown) {
  counters[area] = (counters[area] ?? 0) + 1;
  const err = detail instanceof Error ? { name: detail.name, message: detail.message } : detail;
  console.error(JSON.stringify({ level: "error", area, message, detail: err, at: new Date().toISOString() }));
}

export function logInfo(area: Area, message: string, detail?: unknown) {
  if (process.env.NODE_ENV === "test") return;
  console.info(JSON.stringify({ level: "info", area, message, detail, at: new Date().toISOString() }));
}

/** High-level error counts for the admin dashboard (per server instance). */
export function errorCounts() {
  return { ...counters };
}
