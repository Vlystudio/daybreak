import { describe, expect, it } from "vitest";
import { supabaseChildEnvironment, validatePgTapOutput } from "./remote-db-test-harness.mjs";

describe("portable pgTAP result validation", () => {
  it("accepts a complete passing plan", () => {
    expect(
      validatePgTapOutput(
        [
          { rows: [{ plan: "1..2" }] },
          { rows: [{ ok: "ok 1 - first" }] },
          { rows: [{ ok: "ok 2 - second" }] },
        ],
        "fixture.sql"
      )
    ).toBe(2);
  });

  it("rejects failures and incomplete plans", () => {
    expect(() =>
      validatePgTapOutput(
        [
          { rows: [{ plan: "1..2" }] },
          { rows: [{ ok: "ok 1 - first" }] },
          { rows: [{ ok: "not ok 2 - second" }] },
        ],
        "fixture.sql"
      )
    ).toThrow(/failed 1/);
    expect(() =>
      validatePgTapOutput(
        [{ rows: [{ plan: "1..2" }] }, { rows: [{ ok: "ok 1 - first" }] }],
        "fixture.sql"
      )
    ).toThrow(/observed 1/);
  });
});

describe("Supabase CLI child environment", () => {
  it("removes alternate targets and withholds the password while linking", () => {
    const child = supabaseChildEnvironment(
      {
        PATH: "safe-path",
        SUPABASE_ACCESS_TOKEN: "access-token",
        SUPABASE_DB_PASSWORD: "database-password",
        DATABASE_URL: "postgresql://unexpected",
        PGHOST: "unexpected",
        PGPASSWORD: "unexpected",
        SUPABASE_DB_URL: "postgresql://unexpected",
      },
      false
    );
    expect(child).toEqual({ PATH: "safe-path", SUPABASE_ACCESS_TOKEN: "access-token" });
  });

  it("exposes only the approved password target for destructive linked commands", () => {
    const child = supabaseChildEnvironment(
      {
        SUPABASE_ACCESS_TOKEN: "access-token",
        SUPABASE_DB_PASSWORD: "database-password",
        PGHOST: "unexpected",
      },
      true
    );
    expect(child).toEqual({
      SUPABASE_ACCESS_TOKEN: "access-token",
      SUPABASE_DB_PASSWORD: "database-password",
    });
  });
});
