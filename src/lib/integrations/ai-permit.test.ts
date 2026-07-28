import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
    rpc,
  }),
}));

// Permit-consumption behavior is the subject of this unit. The distributed
// rate limiter has its own tests and uses the same mocked RPC client, which
// would otherwise consume the one-shot RPC response intended for this test.
vi.mock("@/lib/rate-limit", () => ({
  securityRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

import {
  assertAiProcessingPermit,
  authorizeAiEgress,
  getAiProcessingPermit,
} from "@/lib/integrations/ai-permit";

describe("durable AI permits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
    maybeSingle.mockResolvedValue({
      data: {
        allow_ai_basic_processing: true,
        allow_ai_tasks_context: true,
        allow_ai_health_context: false,
        allow_ai_calendar_availability: true,
        allow_ai_calendar_detail: false,
        allow_ai_checkin_context: false,
        allow_ai_profile_context: true,
        allow_ai_uploads: false,
        ai_consent_version: "2026-07-28",
        ai_consent_updated_at: "2026-07-28T11:00:00.000Z",
        ai_consent_expires_at: "2027-01-24T11:00:00.000Z",
      },
      error: null,
    });
    rpc.mockImplementation(async (name: string) =>
      name === "issue_ai_processing_permit"
        ? {
            data: [
              {
                permit_id: "90000000-0000-0000-0000-000000000009",
                consent_epoch: 4,
                expires_at: "2026-07-28T12:02:00.000Z",
                max_uses: 2,
              },
            ],
            error: null,
          }
        : { data: true, error: null }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("mints a frozen, purpose-bound permit from server-side preferences", async () => {
    const permit = await getAiProcessingPermit("user-1", "morning_briefing");
    expect(permit).not.toBeNull();
    expect(Object.isFrozen(permit)).toBe(true);
    expect(permit?.purpose).toBe("morning_briefing");
    expect(permit?.categories).toEqual(["basic", "tasks", "calendar_availability", "profile"]);
  });

  it("rejects wrong-purpose and broader-category use before database consumption", async () => {
    const permit = await getAiProcessingPermit("user-1", "morning_briefing");
    await expect(authorizeAiEgress(permit!, "daily_plan", ["basic"])).rejects.toThrow(
      /not valid for this purpose/i
    );
    await expect(
      authorizeAiEgress(permit!, "morning_briefing", ["basic", "health"])
    ).rejects.toThrow(/does not allow/i);
  });

  it("fails closed when the durable consume check rejects replay or revocation", async () => {
    const permit = await getAiProcessingPermit("user-1", "morning_briefing");
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(authorizeAiEgress(permit!, "morning_briefing", ["basic"])).rejects.toThrow(
      /could not be validated/i
    );
  });

  it("rejects a permit after its short expiry", async () => {
    const permit = await getAiProcessingPermit("user-1", "morning_briefing");
    vi.setSystemTime(new Date("2026-07-28T12:02:01.000Z"));
    expect(() => assertAiProcessingPermit(permit, "morning_briefing")).toThrow(/expired/i);
  });

  it("cannot mint when the user declined basic AI", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        allow_ai_basic_processing: false,
        ai_consent_version: "2026-07-28",
        ai_consent_updated_at: "2026-07-28T11:00:00.000Z",
        ai_consent_expires_at: "2027-01-24T11:00:00.000Z",
      },
      error: null,
    });
    await expect(getAiProcessingPermit("user-1", "health_analysis")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
