import { describe, expect, it } from "vitest";
import {
  assertProcessorEnabled,
  isProcessorEnabled,
  processorRecord,
  unapprovedProductionProcessors,
} from "@/lib/privacy/processors";

describe("processor registry", () => {
  it("allows reviewed code paths in development but blocks unresolved production providers", () => {
    expect(isProcessorEnabled("supabase", "development")).toBe(true);
    expect(isProcessorEnabled("supabase", "production")).toBe(false);
    expect(unapprovedProductionProcessors()).toContain("supabase");
  });

  it("rejects unknown processors", () => {
    expect(processorRecord("unknown")).toBeUndefined();
    expect(() => assertProcessorEnabled("unknown")).toThrow(/not approved/);
  });
});
