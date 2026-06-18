"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generatePlanForUser } from "@/lib/planner";
import type { ActionResult } from "@/actions/schedule";

/** Build an AI smart plan for the user's upcoming days into their schedule. */
export async function generatePlan(): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return { ok: false, error: "You've generated a lot recently — give it a few minutes." };
  }

  try {
    const count = await generatePlanForUser(user.id);
    if (count === null) {
      return { ok: false, error: "Fill out your plan questionnaire and save it first." };
    }
    if (count === 0) {
      return { ok: false, error: "The planner came back empty — try again in a moment." };
    }
    revalidatePath("/dashboard");
    revalidatePath("/schedule");
    return { ok: true };
  } catch (err) {
    console.error("[plan] generation failed:", err instanceof Error ? err.message : "unknown");
    return { ok: false, error: "Couldn't build your plan — please try again in a minute." };
  }
}
