import { describe, expect, it } from "vitest";
import { buildLegacyAppleCleanupPatches } from "./source-cleanup";

describe("Apple Health source isolation", () => {
  it("clears Apple-only legacy fields", () => {
    const patches = buildLegacyAppleCleanupPatches(
      [{ date_local: "2026-07-13", metric: "steps" }],
      []
    );
    expect(patches.get("2026-07-13")).toEqual({ steps: null });
  });

  it("preserves a metric when Oura/Fitbit/manual still owns that date and metric", () => {
    const patches = buildLegacyAppleCleanupPatches(
      [
        { date_local: "2026-07-13", metric: "hrv" },
        { date_local: "2026-07-13", metric: "steps" },
      ],
      [{ date_local: "2026-07-13", metric: "hrv" }]
    );
    expect(patches.get("2026-07-13")).toEqual({ steps: null });
  });
});
