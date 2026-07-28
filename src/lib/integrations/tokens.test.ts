import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/crypto", () => ({
  decryptToken: (value: string) => value.replace(/^enc:/, ""),
  encryptToken: (value: string) => `enc:${value}`,
}));

vi.mock("@/env", () => ({
  serverEnv: () => ({
    FITBIT_CLIENT_ID: "fitbit-id",
    FITBIT_CLIENT_SECRET: "fitbit-secret",
  }),
}));

import {
  ProviderRevocationRetryableError,
  revokeProviderConnection,
} from "@/lib/integrations/tokens";

describe("provider credential revocation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    maybeSingle.mockResolvedValue({
      data: {
        access_token_enc: "enc:access-secret",
        refresh_token_enc: "enc:refresh-secret",
        expires_at: null,
      },
      error: null,
    });
  });

  it("revokes Google with the refresh token and a form body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    await expect(revokeProviderConnection("user-1", "google")).resolves.toMatchObject({
      status: "revoked",
      httpStatus: 200,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
    expect(String(init?.body)).toBe("token=refresh-secret");
    expect(init?.redirect).toBe("error");
  });

  it("uses Fitbit's bearer authorization and revocation form", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    await revokeProviderConnection("user-1", "fitbit");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ Authorization: "Bearer access-secret" });
    expect(String(init?.body)).toBe("token=refresh-secret");
  });

  it("treats an already-invalid grant as an idempotent terminal outcome", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 400 }));
    await expect(revokeProviderConnection("user-1", "oura")).resolves.toMatchObject({
      status: "already_invalid",
      httpStatus: 400,
    });
  });

  it("keeps transient provider failures retryable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    await expect(revokeProviderConnection("user-1", "google")).rejects.toBeInstanceOf(
      ProviderRevocationRetryableError
    );
  });

  it("does not treat an unconfirmed provider rejection as revocation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
    await expect(revokeProviderConnection("user-1", "google")).rejects.toMatchObject({
      code: "provider_rejected",
    });
  });

  it("is idempotent when no local connection exists", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(revokeProviderConnection("user-1", "google")).resolves.toMatchObject({
      status: "already_invalid",
      httpStatus: 204,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
