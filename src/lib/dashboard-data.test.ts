import { afterEach, describe, expect, it, vi } from "vitest";

const { filters, tables, from } = vi.hoisted(() => {
  const filters: Array<[string, string, string, unknown]> = [];
  const tables: string[] = [];
  const from = (table: string) => {
    tables.push(table);
    const data = table === "profiles" ? { id: "user-1", timezone: "America/New_York" } : null;
    const result = { data };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters.push([table, "eq", key, value]);
        return query;
      },
      gte: (key: string, value: unknown) => {
        filters.push([table, "gte", key, value]);
        return query;
      },
      lt: (key: string, value: unknown) => {
        filters.push([table, "lt", key, value]);
        return query;
      },
      is: () => query,
      order: () => query,
      limit: () => query,
      returns: async () => result,
      maybeSingle: async () => result,
    };
    return query;
  };
  return { filters, tables, from };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from, rpc: async () => ({ data: [] }) }),
}));
vi.mock("@/env", () => ({ integrationsAvailable: { openai: () => false } }));
import { loadDashboardData } from "@/lib/dashboard-data";

describe("launch dashboard queries", () => {
  afterEach(() => {
    vi.useRealTimers();
    filters.length = 0;
    tables.length = 0;
  });
  it.each([
    ["2026-09-23T01:00:00Z", "2026-09-22", "2026-09-22T04:00:00.000Z", "2026-09-23T04:00:00.000Z"],
    ["2026-03-08T20:00:00Z", "2026-03-08", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z"],
    ["2026-11-01T20:00:00Z", "2026-11-01", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"],
  ])("loads the user's local day across midnight and DST: %s", async (now, day, start, end) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const data = await loadDashboardData("user-1");
    expect(filters).toContainEqual(["daily_summaries", "eq", "date", day]);
    expect(filters).toContainEqual(["schedule_events", "gte", "starts_at", start]);
    expect(filters).toContainEqual(["schedule_events", "lt", "starts_at", end]);
    expect(tables).not.toContain("food_logs");
    expect(data.todayNutrition).toBeNull();
    expect(data.canGenerateBriefing).toBe(false);
  });
});
