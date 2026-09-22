import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { NUTRITION_ENABLED } from "@/lib/features";

it("redirects legacy photo shares without reading or caching the uploaded image", async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const formData = vi.fn();
  const open = vi.fn();
  const context = {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
    },
    caches: { open },
    URL,
    Response,
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), context);
  expect(Reflect.get(context, "NUTRITION_ENABLED")).toBe(NUTRITION_ENABLED);
  let response: Promise<Response> | undefined;
  handlers.get("fetch")!({
    request: { url: "https://daybreak.example/nutrition/share", method: "POST", formData },
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  const result = await response;
  expect(result?.status).toBe(303);
  expect(result?.headers.get("location")).toBe("https://daybreak.example/dashboard");
  expect(formData).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
