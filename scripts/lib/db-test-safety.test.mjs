import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_APPROVAL,
  DESTRUCTIVE_ACKNOWLEDGEMENT,
  PRODUCTION_APP_ORIGIN,
  PRODUCTION_PROJECT_REF,
  redactDatabaseDiagnostics,
  resolveDatabaseTestOptions,
  validateDatabaseMarker,
  validateManagedAuthOrigin,
  validateRemoteEnvironment,
  validateSyntheticState,
} from "./db-test-safety.mjs";

const remoteEnvironment = {
  DAYBREAK_DB_TEST_MODE: "isolated-remote",
  DAYBREAK_DB_TEST_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa",
  DAYBREAK_DB_TEST_EXPECTED_ROLE: "postgres",
  DAYBREAK_DB_TEST_APPLICATION_ORIGIN: "https://daybreak-db-test.example.invalid",
  DAYBREAK_DB_TEST_ALLOWED_PROJECT_REFS: "aaaaaaaaaaaaaaaaaaaa",
  DAYBREAK_DB_TEST_ALLOWED_DATABASES: "postgres",
  DAYBREAK_DB_TEST_DESTRUCTIVE_ACK: DESTRUCTIVE_ACKNOWLEDGEMENT,
  DAYBREAK_DB_TEST_CREDENTIAL_APPROVAL: CREDENTIAL_APPROVAL,
  SUPABASE_ACCESS_TOKEN: "test-access-token",
  SUPABASE_DB_PASSWORD: "test-database-password",
};

function marker(overrides = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    environment: "isolated-remote-test",
    projectRef: "aaaaaaaaaaaaaaaaaaaa",
    applicationOrigin: "https://daybreak-db-test.example.invalid",
    production: false,
    productionDataPresent: false,
    destructiveTestingAllowed: true,
    approvedRoles: ["postgres"],
    allowedDatabases: ["postgres"],
    expectedInitialAuthUserCount: 0,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  });
}

describe("database test mode selection", () => {
  it("preserves local as the backwards-compatible default", () => {
    expect(resolveDatabaseTestOptions([], {})).toEqual({
      mode: "local",
      preflightOnly: false,
      explicitlySelected: false,
    });
  });

  it("requires an explicit supported value for remote execution", () => {
    expect(resolveDatabaseTestOptions(["--mode", "isolated-remote"], {})).toMatchObject({
      mode: "isolated-remote",
      explicitlySelected: true,
    });
    expect(() =>
      resolveDatabaseTestOptions(["--mode", "isolated-remote"], {
        DAYBREAK_DB_TEST_MODE: "local",
      })
    ).toThrow(/conflict/);
  });
});

describe("isolated remote environment safeguards", () => {
  it("accepts a complete explicit configuration", () => {
    const config = validateRemoteEnvironment(remoteEnvironment);
    expect(config.projectRef).toBe("aaaaaaaaaaaaaaaaaaaa");
    expect(config.allowedDatabases.has("postgres")).toBe(true);
  });

  it("hard denies production regardless of acknowledgements", () => {
    expect(() =>
      validateRemoteEnvironment({
        ...remoteEnvironment,
        DAYBREAK_DB_TEST_PROJECT_REF: PRODUCTION_PROJECT_REF,
        DAYBREAK_DB_TEST_ALLOWED_PROJECT_REFS: PRODUCTION_PROJECT_REF,
      })
    ).toThrow(/unconditionally denied/);
    expect(() =>
      validateRemoteEnvironment({
        ...remoteEnvironment,
        DAYBREAK_DB_TEST_APPLICATION_ORIGIN: PRODUCTION_APP_ORIGIN,
      })
    ).toThrow(/production application origin/);
    expect(() =>
      validateRemoteEnvironment({
        ...remoteEnvironment,
        DAYBREAK_DB_TEST_APPLICATION_ORIGIN: "http://daybreak-db-test.example.invalid",
      })
    ).toThrow(/must use HTTPS/);
  });

  it("rejects missing allowlists and acknowledgements", () => {
    expect(() =>
      validateRemoteEnvironment({
        ...remoteEnvironment,
        DAYBREAK_DB_TEST_ALLOWED_PROJECT_REFS: "bbbbbbbbbbbbbbbbbbbb",
        DAYBREAK_DB_TEST_DESTRUCTIVE_ACK: "yes",
        DAYBREAK_DB_TEST_CREDENTIAL_APPROVAL: "yes",
      })
    ).toThrow(/allowlist.*acknowledgement.*credential approval/);
  });
});

describe("database-resident identity marker", () => {
  const config = validateRemoteEnvironment(remoteEnvironment);
  const observed = {
    databaseName: "postgres",
    currentRole: "postgres",
    productionMarker: "",
  };

  it("accepts a matching, expiring, positive marker", () => {
    expect(validateDatabaseMarker(marker(), observed, config)).toEqual([]);
    expect(
      validateDatabaseMarker(marker(), { ...observed, productionMarker: "false" }, config)
    ).not.toEqual([]);
  });

  it("rejects production, identity mismatch, role mismatch, and expiry", () => {
    const issues = validateDatabaseMarker(
      marker({
        projectRef: "bbbbbbbbbbbbbbbbbbbb",
        production: true,
        expiresAt: "2020-01-01T00:00:00.000Z",
        approvedRoles: ["other"],
      }),
      { ...observed, productionMarker: "true" },
      config
    );
    expect(issues.join(" ")).toMatch(/project reference/);
    expect(issues.join(" ")).toMatch(/production/);
    expect(issues.join(" ")).toMatch(/not approved/);
    expect(issues.join(" ")).toMatch(/expired/);
  });
});

describe("managed Supabase Auth identity", () => {
  const config = validateRemoteEnvironment(remoteEnvironment);

  it("requires the actual Auth site URL to equal the approved test origin", () => {
    expect(validateManagedAuthOrigin("https://daybreak-db-test.example.invalid", config)).toEqual(
      []
    );
    expect(validateManagedAuthOrigin(PRODUCTION_APP_ORIGIN, config)).not.toEqual([]);
    expect(
      validateManagedAuthOrigin("https://daybreak-db-test.example.invalid/unexpected", config)
    ).not.toEqual([]);
  });
});

describe("runtime state and diagnostic protection", () => {
  it("allows only exact recognized synthetic Auth and Storage fixtures", () => {
    expect(
      validateSyntheticState(
        [
          {
            id: "10000000-0000-0000-0000-000000000001",
            email: "alice.rls-test@example.invalid",
          },
        ],
        [{ id: "launch-upgrade-fixture" }],
        [
          {
            bucketId: "launch-upgrade-fixture",
            name: "91000000-0000-0000-0000-000000000021/fixture.txt",
          },
        ]
      )
    ).toEqual([]);
    expect(
      validateSyntheticState(
        [{ id: "10000000-0000-0000-0000-000000000001", email: "real@example.com" }],
        [],
        []
      )
    ).not.toEqual([]);
  });

  it("redacts credentials, URLs, and project references", () => {
    const config = validateRemoteEnvironment(remoteEnvironment);
    const redacted = redactDatabaseDiagnostics(
      `token=${config.accessToken} password=${config.databasePassword} ` +
        `postgresql://postgres:${config.databasePassword}@db.${config.projectRef}.supabase.co/postgres`,
      config
    );
    expect(redacted).not.toContain(config.accessToken);
    expect(redacted).not.toContain(config.databasePassword);
    expect(redacted).not.toContain(config.projectRef);
  });
});
