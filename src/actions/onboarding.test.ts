import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert, revalidatePath } = vi.hoisted(() => ({
  upsert: vi.fn().mockResolvedValue({ error: null }),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: () => ({ upsert }) }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  RATE_LIMITS: { mutation: {} },
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { savePlanPreferences, saveOnboarding } from "@/actions/onboarding";
import type { OnboardingInput } from "@/lib/validation";

describe("launch plan preferences", () => {
  beforeEach(() => vi.clearAllMocks());
  it("saves a useful routine without requiring a fitness or diet questionnaire", async () => {
    expect(
      await savePlanPreferences({
        wakeTime: "07:00",
        sleepTime: "23:00",
        planningScope: "few_days",
      })
    ).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        work_days: [],
        work_start_time: null,
        work_end_time: null,
        wake_time: "07:00",
        sleep_time: "23:00",
        planning_scope: "few_days",
        auto_plan_cadence: "off",
        onboarding_completed: true,
      },
      { onConflict: "user_id" }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/schedule");
  });
  it("does not overwrite deferred data even through the legacy form action", async () => {
    const input = {
      workType: "office",
      activityLevel: "light",
      exerciseFrequency: "none",
      socialTendency: "balanced",
      planningScope: "few_days",
      fitnessGoal: "weight_loss",
      weightLb: 170,
      dietaryRestrictions: ["vegan"],
      allow_ai_basic_processing: true,
    };
    expect(await saveOnboarding(input as OnboardingInput)).toEqual({ ok: true });
    const values = upsert.mock.calls[0][0];
    for (const key of [
      "fitness_goal",
      "weight_lb",
      "dietary_restrictions",
      "allow_ai_basic_processing",
    ])
      expect(values).not.toHaveProperty(key);
  });
  it.each([
    { workDays: ["Monday"], workStartTime: "09:00" },
    { workDays: ["Monday"], workStartTime: "09:00", workEndTime: "09:00" },
    { workDays: ["invalid"] },
    { wakeTime: "25:00" },
  ])("rejects invalid times and work days before persisting: %j", async (fields) => {
    expect((await savePlanPreferences({ planningScope: "few_days", ...fields })).ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});
