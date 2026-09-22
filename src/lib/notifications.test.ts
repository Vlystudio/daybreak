import { describe, expect, it } from "vitest";
import { MORNING_NOTIFICATION, renderMorningEmail, renderMorningText } from "@/lib/notifications";

describe("morning notification privacy", () => {
  it("contains only a neutral authenticated-app prompt", () => {
    const sensitiveFixtures = [
      "resting heart rate",
      "therapy appointment",
      "poor sleep",
      "body weight",
      "calendar meeting",
    ];
    const output = [
      MORNING_NOTIFICATION.title,
      MORNING_NOTIFICATION.body,
      renderMorningEmail("https://example.test/unsubscribe"),
      renderMorningText("https://example.test/unsubscribe"),
    ]
      .join(" ")
      .toLowerCase();

    for (const value of sensitiveFixtures) expect(output).not.toContain(value);
    expect(output).toContain("open daybreak");
  });
});
