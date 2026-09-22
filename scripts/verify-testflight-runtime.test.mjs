import { describe, expect, it } from "vitest";
import { origin, verifyRuntime } from "./verify-testflight-runtime.mjs";

const html = "Sign in mailto:support@example.test Privacy Policy Terms of Service Consumer Health";
function healthyResponse(url) {
  expect(url.startsWith(`${origin}/`)).toBe(true);
  return url.endsWith("manifest.webmanifest")
    ? Response.json({ name: "Daybreak" })
    : new Response(html, { headers: { "content-type": "text/html" } });
}

describe("internal TestFlight live runtime preflight", () => {
  it("accepts the reviewed live routes without sending credentials or following redirects", async () => {
    const checks = await verifyRuntime(async (url, options) => {
      expect(options.redirect).toBe("manual");
      expect(options.headers).toBeUndefined();
      return healthyResponse(url);
    });
    expect(checks.every((check) => check.status === "pass")).toBe(true);
  });

  it.each([302, 401, 500])(
    "rejects HTTP %i instead of treating a login/error page as healthy",
    async (status) => {
      const checks = await verifyRuntime(async (url) =>
        url.endsWith("/privacy") ? new Response("", { status }) : healthyResponse(url)
      );
      expect(checks.find((check) => check.route === "/privacy").status).toBe("fail");
    }
  );

  it("rejects an old deployment still advertising meal/receipt sharing", async () => {
    const checks = await verifyRuntime(async (url) =>
      url.endsWith("manifest.webmanifest")
        ? Response.json({ name: "Daybreak", share_target: { action: "/nutrition/share" } })
        : healthyResponse(url)
    );
    expect(checks.at(-1).status).toBe("fail");
  });

  it("rejects a legal configuration error even when HTTP is 200", async () => {
    const checks = await verifyRuntime(async (url) =>
      url.endsWith("/terms")
        ? new Response("Terms of Service: Legal configuration is incomplete", {
            headers: { "content-type": "text/html" },
          })
        : healthyResponse(url)
    );
    expect(checks.find((check) => check.route === "/terms").status).toBe("fail");
  });
});
