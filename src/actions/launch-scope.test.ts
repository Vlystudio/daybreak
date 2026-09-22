import { describe, expect, it, vi } from "vitest";

const { requireUser, createClient, createAdminClient } = vi.hoisted(() => ({
  requireUser: vi.fn(() => {
    throw new Error("Disabled feature reached authentication");
  }),
  createClient: vi.fn(() => {
    throw new Error("Disabled feature reached the database");
  }),
  createAdminClient: vi.fn(() => {
    throw new Error("Disabled feature reached the admin database");
  }),
}));
vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import * as grocery from "@/actions/grocery";
import * as shopping from "@/actions/shopping";
import * as mealPlan from "@/actions/meal-plan";
import * as meals from "@/actions/meals";
import * as fitness from "@/actions/fitness";
import * as trainer from "@/actions/trainer";
import * as intake from "@/actions/intake";
import * as goals from "@/actions/goals";

describe("deferred launch features", () => {
  for (const [group, actions] of Object.entries({
    grocery,
    shopping,
    mealPlan,
    meals,
    fitness,
    trainer,
    intake,
    goals,
  })) {
    for (const [name, action] of Object.entries(actions)) {
      it(`blocks ${group}.${name} before authentication or persistence, including stale clients`, async () => {
        const result = await (action as () => Promise<{ ok: boolean; error?: string }>)();
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/not available in this release/);
        expect(requireUser).not.toHaveBeenCalled();
        expect(createClient).not.toHaveBeenCalled();
        expect(createAdminClient).not.toHaveBeenCalled();
      });
    }
  }
});
