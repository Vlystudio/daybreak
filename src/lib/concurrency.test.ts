import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("returns results in input order", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 2);
    expect(out.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([2, 4, 6, 8]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      }
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1); // proves work actually overlapped
  });

  it("isolates failures without aborting the rest", async () => {
    const out = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(out[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(out[1].status).toBe("rejected");
    expect(out[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
