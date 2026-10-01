import "server-only";
import { env, isAiConfigured } from "@/lib/env";
import { logError } from "@/lib/logger";

/**
 * Minimal Ollama client (local AI only — no cloud model APIs).
 * Uses /api/chat with `format: "json"` so the model must return JSON,
 * which callers then validate with zod before trusting.
 */
export async function ollamaJson(system: string, user: string, opts: { timeoutMs?: number; retries?: number } = {}) {
  if (!isAiConfigured()) return null;
  const retries = opts.retries ?? 1;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
    try {
      const res = await fetch(`${env.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        cache: "no-store",
        body: JSON.stringify({
          model: env.ollamaModel,
          stream: false,
          format: "json",
          options: { temperature: 0.1 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      const content = data.message?.content ?? "";
      return JSON.parse(content) as unknown;
    } catch (e) {
      logError("ai", `Ollama call failed (attempt ${attempt + 1}/${retries + 1})`, e);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
