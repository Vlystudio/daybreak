"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generatePlanForUser, generateTodayPlanForUser } from "@/lib/planner";
import type { ActionResult } from "@/actions/schedule";
import { AI_CONSENT_REQUIRED_ERROR, getAiProcessingPermit } from "@/lib/integrations/ai-permit";

/** Remove every AI-planned block (a clean slate), leaving manual/Google events. */
export async function clearPlan(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "plan");
  if (error) return { ok: false, error: "Couldn't clear the plan." };

  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true };
}

/** Build (or rebuild) just TODAY's plan, regardless of the saved scope. */
export async function generateTodayPlan(): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await getAiProcessingPermit(user.id))) {
    return { ok: false, error: AI_CONSENT_REQUIRED_ERROR };
  }

  const limited = await rateLimit(`ai:${user.id}`, RATE_LIMITS.aiSummary);
  if (!limited.ok) {
    return { ok: false, error: "You've generated a lot recently — give it a few minutes." };
  }

  try {
    const count = await generateTodayPlanForUser(user.id);
    if (count === null) {
      return { ok: false, error: "Fill out your plan questionnaire and save it first." };
    }
    revalidatePath("/dashboard");
    revalidatePath("/schedule");
    return { ok: true };
  } catch (err) {
    console.error(
      "[plan] today generation failed:",
      err instanceof Error ? err.message : "unknown"
    );
    return { ok: false, error: "Couldn't build today's plan — please try again in a minute." };
  }
}

/** Build an AI smart plan for the user's upcoming days into their schedule. */
export async function generatePlan(): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await getAiProcessingPermit(user.id))) {
    return { ok: false, error: AI_CONSENT_REQUIRED_ERROR };
  }

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
