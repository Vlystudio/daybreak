import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production HealthKit purpose strings", () => {
  const prepareScript = readFileSync("scripts/ios-prepare.sh", "utf8");

  it("names categories, visible use, server transfer, and separate AI consent", () => {
    expect(prepareScript).toContain("sleep, heart-rate, activity, body, and workout summaries");
    expect(prepareScript).toContain("show trends and adapt your wellness plan");
    expect(prepareScript).toContain("sent to Daybreak servers");
    expect(prepareScript).toContain("separately enable Health AI sharing");
  });

  it("truthfully declares the read-only boundary", () => {
    expect(prepareScript).toContain("requests no Apple Health write access");
    expect(prepareScript).toContain("never writes measured or AI-generated data to HealthKit");
  });
});
