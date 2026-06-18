"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateFitnessPlanForUser } from "@/lib/trainer";
import type { ActionResult } from "@/actions/schedule";

/** Generate the user's workout + nutrition regimen. */
export async function generateFitnessPlan(): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return { ok: false, error: "You've generated a lot recently — give it a few minutes." };
  }

  try {
    const result = await generateFitnessPlanForUser(user.id);
    if (result === "missing_metrics") {
      return { ok: false, error: "Add your height and weight on the Plan tab first." };
    }
    if (result === "failed") {
      return { ok: false, error: "Couldn't build your regimen — please try again in a minute." };
    }
    revalidatePath("/trainer");
    return { ok: true };
  } catch (err) {
    console.error("[trainer] generation failed:", err instanceof Error ? err.message : "unknown");
    return { ok: false, error: "Couldn't build your regimen — please try again in a minute." };
  }
}
