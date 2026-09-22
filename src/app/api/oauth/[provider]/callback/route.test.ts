import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signState } from "@/lib/crypto";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  enabled: true,
  exchange: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getUser: async () => ({ id: "fixture-user" }),
  isAuthenticatedUserEligible: async () => true,
}));
vi.mock("@/env", async (original) => ({
  ...(await original<typeof import("@/env")>()),
  publicEnv: { NEXT_PUBLIC_APP_URL: "https://daybreak.example" },
  integrationsAvailable: { google: () => true },
}));
vi.mock("@/lib/privacy/processors", () => ({
  isProcessorEnabled: () => mocks.enabled,
}));
vi.mock("@/lib/integrations/oauth-providers", () => ({
  OAUTH_PROVIDER_NAMES: ["google"],
  OAUTH_PROVIDERS: { google: { kind: "calendar", exchangeCode: mocks.exchange } },
}));
vi.mock("@/lib/integrations/tokens", () => ({ saveConnection: mocks.save }));
vi.mock("@/lib/sync", () => ({
  syncWearableForUser: vi.fn(),
  syncCalendarForUser: vi.fn(),
  generateSummaryForUser: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

async function callback(state?: string, nonce?: string, code: string | null = "fixture-code") {
  const url = new URL("https://daybreak.example/api/oauth/google/callback");
  if (state !== undefined) url.searchParams.set("state", state);
  if (code !== null) url.searchParams.set("code", code);
  return GET(
    new NextRequest(url, { headers: nonce ? { cookie: `oauth_nonce_google=${nonce}` } : {} }),
    { params: Promise.resolve({ provider: "google" }) }
  );
}

describe("OAuth callback state boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.exchange.mockResolvedValue({ accessToken: "fixture-token" });
  });

  it.each([
    "missing state",
    "empty state",
    "forged signature",
    "wrong user",
    "wrong nonce",
    "missing cookie",
    "missing code",
  ])("rejects %s before token exchange or storage", async (scenario) => {
    let state: string | undefined = signState("fixture-user:fixture-nonce");
    let nonce: string | undefined = "fixture-nonce";
    let code: string | null = "fixture-code";
    if (scenario === "missing state") state = undefined;
    if (scenario === "empty state") state = "";
    if (scenario === "forged signature") state = "fixture-user:fixture-nonce.forged";
    if (scenario === "wrong user") state = signState("another-user:fixture-nonce");
    if (scenario === "wrong nonce") nonce = "different-nonce";
    if (scenario === "missing cookie") nonce = undefined;
    if (scenario === "missing code") code = null;
    const response = await callback(state, nonce, code);
    expect(response.headers.get("location")).toContain("connect_error=invalid_state");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("blocks a paused provider even with valid signed state", async () => {
    mocks.enabled = false;
    const response = await callback(signState("fixture-user:fixture-nonce"), "fixture-nonce");
    expect(response.headers.get("location")).toContain("connect_error=unavailable");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("accepts the signed-in user's matching signed nonce and clears it", async () => {
    const response = await callback(signState("fixture-user:fixture-nonce"), "fixture-nonce");
    expect(response.headers.get("location")).toContain("connected=google");
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith("fixture-code");
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("fixture-user", "google", {
      accessToken: "fixture-token",
    });
    expect(response.cookies.get("oauth_nonce_google")?.value).toBe("");
  });
});
