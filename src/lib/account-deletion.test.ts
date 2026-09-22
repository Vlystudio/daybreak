import { describe, expect, it, vi } from "vitest";
import {
  AccountDeletionError,
  buildAccountDeletionSteps,
  hashDeletionStatusToken,
  isAuthUserAlreadyDeleted,
  removeUserStorage,
  runAccountDeletionSteps,
  type AdminClient,
} from "@/lib/account-deletion";

describe("account deletion orchestration", () => {
  it("defines the real Auth deletion step last", () => {
    const steps = buildAccountDeletionSteps(
      {} as AdminClient,
      "00000000-0000-0000-0000-000000000001"
    );
    expect(steps.map((step) => step.name)).toEqual([
      "storage",
      "local credentials and notifications",
      "social relationships",
      "retained-reference cleanup",
      "authentication account and sessions",
    ]);
    expect(steps.at(-1)?.name).toBe("authentication account and sessions");
  });

  it("hashes opaque status capabilities without retaining the token", () => {
    const token = "a".repeat(43);
    expect(hashDeletionStatusToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDeletionStatusToken(token)).toBe(hashDeletionStatusToken(token));
    expect(hashDeletionStatusToken(`${token}b`)).not.toBe(hashDeletionStatusToken(token));
  });

  it("treats only explicit Auth not-found responses as idempotent deletion", () => {
    expect(isAuthUserAlreadyDeleted(Object.assign(new Error("missing"), { status: 404 }))).toBe(
      true
    );
    expect(
      isAuthUserAlreadyDeleted(Object.assign(new Error("missing"), { code: "user_not_found" }))
    ).toBe(true);
    expect(isAuthUserAlreadyDeleted(Object.assign(new Error("outage"), { status: 500 }))).toBe(
      false
    );
    expect(isAuthUserAlreadyDeleted(new Error("ambiguous"))).toBe(false);
  });

  it("runs Auth deletion last", async () => {
    const order: string[] = [];
    await runAccountDeletionSteps([
      { name: "storage", run: async () => void order.push("storage") },
      { name: "rows", run: async () => void order.push("rows") },
      { name: "auth", run: async () => void order.push("auth") },
    ]);
    expect(order).toEqual(["storage", "rows", "auth"]);
  });

  it("stops before Auth deletion on a partial cleanup failure", async () => {
    const auth = vi.fn();
    await expect(
      runAccountDeletionSteps([
        { name: "storage", run: async () => {} },
        { name: "provider credentials", run: async () => Promise.reject(new Error("failed")) },
        { name: "auth", run: auth },
      ])
    ).rejects.toMatchObject({
      step: "provider credentials",
    } satisfies Partial<AccountDeletionError>);
    expect(auth).not.toHaveBeenCalled();
  });

  it("enumerates every bucket and removes nested and conventional user paths", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const list = vi.fn(
      async (bucket: string, prefix: string): Promise<{ data: object[]; error: null }> => {
        const rows: Record<string, object[]> = {
          [`avatars:${userId}`]: [
            { id: "avatar-object", name: "avatar.jpg" },
            { id: null, name: "nested" },
          ],
          [`avatars:${userId}/nested`]: [{ id: "nested-object", name: "older.jpg" }],
        };
        return { data: rows[`${bucket}:${prefix}`] ?? [], error: null };
      }
    );
    const remove = vi.fn(async (bucket: string, paths: string[]) => {
      void bucket;
      void paths;
      return { error: null };
    });
    const from = vi.fn((bucket: string) => ({
      list: (prefix: string) => list(bucket, prefix),
      remove: (paths: string[]) => remove(bucket, paths),
    }));
    const listBuckets = vi.fn(async () => ({
      data: [{ name: "avatars" }, { name: "exports" }],
      error: null,
    }));
    const admin = { storage: { listBuckets, from } } as unknown as AdminClient;

    await removeUserStorage(admin, userId);

    expect(listBuckets).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith("avatars", userId);
    expect(list).toHaveBeenCalledWith("avatars", `${userId}/nested`);
    expect(list).toHaveBeenCalledWith("avatars", `users/${userId}`);
    expect(list).toHaveBeenCalledWith("exports", userId);
    expect(list).toHaveBeenCalledWith("exports", `users/${userId}`);
    expect(remove).toHaveBeenCalledWith("avatars", [`${userId}/nested/older.jpg`]);
    expect(remove).toHaveBeenCalledWith("avatars", [`${userId}/avatar.jpg`]);
    for (const bucket of ["avatars", "exports"]) {
      expect(remove).toHaveBeenCalledWith(
        bucket,
        ["jpg", "jpeg", "png", "webp", "zip", "json"].map((extension) => `${userId}.${extension}`)
      );
    }
  });
});
