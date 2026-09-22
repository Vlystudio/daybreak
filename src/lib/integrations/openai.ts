import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { serverEnv } from "@/env";
import {
  assertAiProcessingPermit,
  authorizeAiEgress,
  type AiProcessingPermit,
} from "@/lib/integrations/ai-permit";
import type { AiDataCategory, AiPurpose } from "@/lib/integrations/ai-consent";
import { assertAiProviderEnabled } from "@/lib/integrations/ai-provider-registry";
import { safeLog } from "@/lib/security/safe-logger";

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

const MAX_AI_REQUEST_BYTES = 12 * 1024 * 1024;
const OPENAI_ORIGIN = "https://api.openai.com";

/** SDK transport guard: fixed destination, bounded body, and no HTTP caching. */
async function aiGatewayFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(rawUrl);
  if (url.origin !== OPENAI_ORIGIN) throw new Error("Unregistered AI provider destination.");
  const body = init?.body;
  const bodyBytes =
    typeof body === "string"
      ? Buffer.byteLength(body, "utf8")
      : body instanceof Uint8Array
        ? body.byteLength
        : 0;
  if (bodyBytes > MAX_AI_REQUEST_BYTES) throw new Error("AI request exceeds the size limit.");
  return fetch(input, { ...init, cache: "no-store", redirect: "error" });
}

export async function openaiClient(
  permit: AiProcessingPermit,
  purpose: AiPurpose,
  requiredCategories: readonly AiDataCategory[] = []
): Promise<OpenAI | null> {
  // Reject forged or missing permits before inspecting provider configuration,
  // but defer the durable one-use consumption until a provider/key is ready.
  assertAiProcessingPermit(permit, purpose, requiredCategories);
  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) return null;
  assertAiProviderEnabled("openai");
  await authorizeAiEgress(permit, purpose, requiredCategories);
  if (!cached || cachedKey !== apiKey) {
    // 60s is generous for our largest structured generations (~2k tokens) while
    // still bounding a hang far below the SDK default. One retry covers a
    // transient blip without multiplying latency.
    cached = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1, fetch: aiGatewayFetch });
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
  safeLog("info", "ai.usage", {
    provider: "openai",
    feature,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  });
}

/**
 * Stable SHA-256 of a generation's input payload, used as a skip-if-unchanged
 * cache key: if the inputs the model would see are byte-identical to the last
 * run, reuse the stored result instead of paying to regenerate it.
 */
export function inputHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
