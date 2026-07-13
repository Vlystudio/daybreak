import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { serverEnv } from "@/env";
import { assertAiProcessingPermit, type AiProcessingPermit } from "@/lib/integrations/ai-permit";

/**
 * Shared OpenAI client + lightweight cost telemetry.
 *
 * Every AI feature funnels through `openaiClient()` so there is ONE place that
 * configures the client. Two things live here that individual callers used to
 * miss:
 *   - a serverless-safe request timeout + small retry budget, so a hung call
 *     can't sit on the SDK's 10-minute default and burn function time;
 *   - `logUsage`, which records token counts per feature so spend can be
 *     attributed from logs (and a runaway caught) without code archaeology.
 *
 * Returns null when OPENAI_API_KEY isn't set — matching the "no key → no-op"
 * contract every caller already relies on.
 */

let cached: OpenAI | null = null;
let cachedKey: string | null = null;

export function openaiClient(permit: AiProcessingPermit): OpenAI | null {
  assertAiProcessingPermit(permit);
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!cached || cachedKey !== apiKey) {
    // 60s is generous for our largest structured generations (~2k tokens) while
    // still bounding a hang far below the SDK default. One retry covers a
    // transient blip without multiplying latency.
    cached = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
    cachedKey = apiKey;
  }
  return cached;
}

type Usage =
  | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  | null
  | undefined;

/**
 * Log token counts for one OpenAI call, tagged by feature. Tokens ONLY — never
 * the prompt or response, so health data stays unlogged as it is everywhere
 * else. Grep `[openai usage]` to attribute spend per feature.
 */
export function logUsage(feature: string, usage: Usage): void {
  if (!usage) return;
  console.info(
    `[openai usage] feature=${feature} prompt=${usage.prompt_tokens ?? 0} ` +
      `completion=${usage.completion_tokens ?? 0} total=${usage.total_tokens ?? 0}`
  );
}

/**
 * Stable SHA-256 of a generation's input payload, used as a skip-if-unchanged
 * cache key: if the inputs the model would see are byte-identical to the last
 * run, reuse the stored result instead of paying to regenerate it.
 */
export function inputHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
