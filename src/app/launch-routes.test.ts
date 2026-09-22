import { describe, expect, it, vi } from "vitest";

const { requireUser, notFound } = vi.hoisted(() => ({
  requireUser: vi.fn(() => {
    throw new Error("Unexpected authentication");
  }),
  notFound: vi.fn(() => {
    throw new Error("LAUNCH_ROUTE_UNAVAILABLE");
  }),
}));
vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("next/navigation", () => ({ notFound }));

const pages = [
  ["Coach", () => import("@/app/(app)/coach/page")],
  ["Nutrition", () => import("@/app/(app)/nutrition/page")],
  ["Photo share", () => import("@/app/(app)/nutrition/share/page")],
  ["Grocery", () => import("@/app/(app)/grocery/page")],
  ["Meal plan", () => import("@/app/(app)/grocery/plan/page")],
  ["Pantry", () => import("@/app/(app)/grocery/pantry/page")],
  ["Prices", () => import("@/app/(app)/grocery/prices/page")],
  ["Shopping lists", () => import("@/app/(app)/grocery/lists/page")],
  ["Shopping list detail", () => import("@/app/(app)/grocery/lists/[id]/page")],
] as const;

describe("deferred routes", () => {
  it.each(pages)("blocks direct access to %s before loading account data", async (_name, load) => {
    const pageModule = await load();
    const render = pageModule.default as (props: { params: Promise<{ id: string }> }) => unknown;
    await expect(
      Promise.resolve().then(() => render({ params: Promise.resolve({ id: "example-list" }) }))
    ).rejects.toThrow("LAUNCH_ROUTE_UNAVAILABLE");
    expect(requireUser).not.toHaveBeenCalled();
  });
});
