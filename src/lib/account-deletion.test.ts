import { describe, expect, it, vi } from "vitest";
import {
  AccountDeletionError,
  buildAccountDeletionSteps,
  runAccountDeletionSteps,
  type AdminClient,
} from "@/lib/account-deletion";

describe("account deletion orchestration", () => {
  it("defines the real Auth deletion step last", () => {
    const steps = buildAccountDeletionSteps(
      {} as AdminClient,
      "00000000-0000-0000-0000-000000000001"
    );
    expect(steps.map((step) => step.name)).toEqual([
      "storage",
      "provider credentials and notifications",
      "social relationships",
      "retained-reference cleanup",
      "authentication account",
    ]);
    expect(steps.at(-1)?.name).toBe("authentication account");
  });

  it("runs Auth deletion last", async () => {
    const order: string[] = [];
    await runAccountDeletionSteps([
      { name: "storage", run: async () => void order.push("storage") },
      { name: "rows", run: async () => void order.push("rows") },
      { name: "auth", run: async () => void order.push("auth") },
    ]);
    expect(order).toEqual(["storage", "rows", "auth"]);
  });

  it("stops before Auth deletion on a partial cleanup failure", async () => {
    const auth = vi.fn();
    await expect(
      runAccountDeletionSteps([
        { name: "storage", run: async () => {} },
        { name: "provider credentials", run: async () => Promise.reject(new Error("failed")) },
        { name: "auth", run: auth },
      ])
    ).rejects.toMatchObject({
      step: "provider credentials",
    } satisfies Partial<AccountDeletionError>);
    expect(auth).not.toHaveBeenCalled();
  });
});
