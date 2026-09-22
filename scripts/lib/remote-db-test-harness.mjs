import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import {
  PRODUCTION_MARKER_SETTING,
  SYNTHETIC_AUTH_USERS,
  TEST_MARKER_SETTING,
  redactDatabaseDiagnostics,
  validateDatabaseMarker,
  validateManagedAuthOrigin,
  validateRemoteEnvironment,
  validateSyntheticState,
} from "./db-test-safety.mjs";

const { Client } = pg;
export const SUPABASE_VERSION = "2.108.0";

function npxInvocation() {
  if (process.platform !== "win32") return { command: "npx", prefix: [] };
  return {
    command: process.execPath,
    prefix: [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")],
  };
}

function flattenTapResults(result) {
  const results = Array.isArray(result) ? result : [result];
  return results.flatMap((entry) =>
    (entry?.rows ?? []).flatMap((row) =>
      Object.values(row).filter((value) => typeof value === "string")
    )
  );
}

export function validatePgTapOutput(result, file) {
  const output = flattenTapResults(result);
  const plan = output.find((value) => /^1\.\.\d+$/.test(value));
  const assertions = output.filter((value) => /^(?:not )?ok \d+\b/.test(value));
  const failures = assertions.filter((value) => value.startsWith("not ok"));
  const planned = plan ? Number(plan.slice(3)) : null;
  if (planned === null || assertions.length !== planned || failures.length > 0) {
    throw new Error(
      `${file} failed pgTAP validation (planned ${planned ?? "none"}, observed ${assertions.length}, failed ${failures.length}).`
    );
  }
  return planned;
}

export function supabaseChildEnvironment(environment, includeDatabasePassword) {
  const childEnvironment = { ...environment };
  for (const name of [
    "DATABASE_URL",
    "PGCONNECT_TIMEOUT",
    "PGHOST",
    "PGPASSWORD",
    "PGPORT",
    "PGUSER",
    "SUPABASE_DB_URL",
  ]) {
    delete childEnvironment[name];
  }
  if (!includeDatabasePassword) delete childEnvironment.SUPABASE_DB_PASSWORD;
  return childEnvironment;
}

export class RemoteDatabaseTestHarness {
  constructor(root, environment = process.env) {
    this.root = root;
    this.environment = environment;
    this.config = validateRemoteEnvironment(environment);
    this.tempRoot = null;
    this.client = null;
    this.pooler = null;
  }

  diagnostic(value) {
    return redactDatabaseDiagnostics(value, this.config);
  }

  runSupabase(args, { quiet = false, includeDatabasePassword = true } = {}) {
    const invocation = npxInvocation();
    const childEnvironment = supabaseChildEnvironment(this.environment, includeDatabasePassword);
    const result = spawnSync(
      invocation.command,
      [
        ...invocation.prefix,
        "--yes",
        `supabase@${SUPABASE_VERSION}`,
        ...args,
        "--workdir",
        this.tempRoot,
      ],
      {
        cwd: this.root,
        encoding: "utf8",
        shell: false,
        env: childEnvironment,
        stdio: "pipe",
      }
    );
    const output = this.diagnostic(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
    if (result.error || result.status !== 0) {
      throw new Error(
        `${args.slice(0, 2).join(" ")} failed (${this.diagnostic(result.error?.message ?? result.status)}).${
          output ? ` ${output}` : ""
        }`
      );
    }
    if (!quiet && output) console.log(output);
  }

  async initialize() {
    this.tempRoot = mkdtempSync(path.join(tmpdir(), "daybreak-db-test-"));
    cpSync(path.join(this.root, "supabase"), path.join(this.tempRoot, "supabase"), {
      recursive: true,
      filter: (source) => path.basename(source) !== ".temp",
    });
    this.runSupabase(["link", "--project-ref", this.config.projectRef, "--yes"], {
      quiet: true,
      includeDatabasePassword: false,
    });

    const projectRefPath = path.join(this.tempRoot, "supabase", ".temp", "project-ref");
    const poolerPath = path.join(this.tempRoot, "supabase", ".temp", "pooler-url");
    if (!existsSync(projectRefPath) || !existsSync(poolerPath)) {
      throw new Error("the temporary Supabase link did not establish remote identity metadata.");
    }
    if (readFileSync(projectRefPath, "utf8").trim() !== this.config.projectRef) {
      throw new Error("the temporary Supabase link resolved to an unexpected project.");
    }
    await this.verifyManagedAuthOrigin();
    this.pooler = new URL(readFileSync(poolerPath, "utf8").trim());
    if (
      !new Set(["postgres:", "postgresql:"]).has(this.pooler.protocol) ||
      !this.pooler.hostname.endsWith(".supabase.com") ||
      this.pooler.password ||
      decodeURIComponent(this.pooler.username) !== `postgres.${this.config.projectRef}`
    ) {
      throw new Error(
        "the linked pooler identity is not the expected credential-free Supabase target."
      );
    }
    await this.connect();
    await this.assertSafety();
  }

  async verifyManagedAuthOrigin() {
    let response;
    try {
      response = await fetch(
        `https://api.supabase.com/v1/projects/${encodeURIComponent(this.config.projectRef)}/config/auth`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            Accept: "application/json",
          },
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        }
      );
    } catch (error) {
      throw new Error(`Supabase Auth identity check failed: ${this.diagnostic(error.message)}`);
    }
    if (!response.ok) {
      throw new Error(
        "Supabase Auth identity check failed; the access token needs read access to project Auth configuration."
      );
    }
    let authConfig;
    try {
      authConfig = await response.json();
    } catch {
      throw new Error("Supabase Auth identity check returned an invalid response.");
    }
    const issues = validateManagedAuthOrigin(authConfig.site_url, this.config);
    if (issues.length > 0) throw new Error(issues.join(" "));
  }

  async connect() {
    if (this.client) return;
    this.client = new Client({
      host: this.pooler.hostname,
      port: Number(this.pooler.port || 5432),
      user: decodeURIComponent(this.pooler.username),
      database: decodeURIComponent(this.pooler.pathname.slice(1)),
      password: this.config.databasePassword,
      ssl: { rejectUnauthorized: true },
      application_name: "daybreak-isolated-database-tests",
      connectionTimeoutMillis: 15_000,
    });
    try {
      await this.client.connect();
    } catch (error) {
      this.client = null;
      throw new Error(`remote database connection failed: ${this.diagnostic(error.message)}`);
    }
  }

  async disconnect() {
    if (!this.client) return;
    const client = this.client;
    this.client = null;
    try {
      await client.end();
    } catch {
      // A remote reset can terminate idle sessions. Cleanup remains best-effort.
    }
  }

  async reconnect() {
    await this.disconnect();
    await this.connect();
    await this.assertSafety();
  }

  async databaseSetting(name) {
    const result = await this.client.query(
      `select substring(setting from length($1) + 2) as value
       from pg_database d
       join pg_db_role_setting s on s.setdatabase = d.oid and s.setrole = 0
       cross join lateral unnest(s.setconfig) setting
       where d.datname = current_database() and setting like $1 || '=%'
       limit 1`,
      [name]
    );
    return result.rows[0]?.value ?? "";
  }

  async assertSafety() {
    try {
      const [identity, markerValue, productionMarker, auth, buckets, objects] = await Promise.all([
        this.client.query(
          "select current_database() as database_name, current_user as current_role"
        ),
        this.databaseSetting(TEST_MARKER_SETTING),
        this.databaseSetting(PRODUCTION_MARKER_SETTING),
        this.client.query(
          "select id::text, coalesce(email, '') as email from auth.users order by id"
        ),
        this.client.query("select id::text from storage.buckets order by id"),
        this.client.query(
          "select bucket_id::text, name::text from storage.objects order by bucket_id, name"
        ),
      ]);
      const observed = {
        databaseName: identity.rows[0]?.database_name,
        currentRole: identity.rows[0]?.current_role,
        productionMarker,
      };
      const issues = [
        ...validateDatabaseMarker(markerValue, observed, this.config),
        ...validateSyntheticState(
          auth.rows,
          buckets.rows,
          objects.rows.map((object) => ({ bucketId: object.bucket_id, name: object.name }))
        ),
      ];
      if (issues.length > 0) throw new Error(issues.join(" "));
      return observed;
    } catch (error) {
      throw new Error(
        `remote database safeguard denied execution: ${this.diagnostic(error.message)}`
      );
    }
  }

  async executeSql(source, label) {
    await this.assertSafety();
    try {
      return await this.client.query(source);
    } catch (error) {
      throw new Error(`${label} failed: ${this.diagnostic(error.message)}`);
    }
  }

  async cleanupRecognizedFixtures() {
    await this.assertSafety();
    const ids = [...SYNTHETIC_AUTH_USERS.keys()];
    await this.client.query("begin");
    try {
      await this.client.query("delete from storage.objects where bucket_id = any($1::text[])", [
        ["avatars", "launch-upgrade-fixture"],
      ]);
      await this.client.query("delete from storage.buckets where id = any($1::text[])", [
        ["avatars", "launch-upgrade-fixture"],
      ]);
      await this.client.query("delete from auth.users where id = any($1::uuid[])", [ids]);
      await this.client.query("commit");
    } catch (error) {
      await this.client.query("rollback");
      throw new Error(`recognized fixture cleanup failed: ${this.diagnostic(error.message)}`);
    }
    const observed = await this.assertSafety();
    const count = await this.client.query("select count(*)::int as count from auth.users");
    if (count.rows[0].count !== 0) {
      throw new Error("remote database safeguard denied reset because Auth is not empty.");
    }
    return observed;
  }

  async reset(version = null) {
    await this.cleanupRecognizedFixtures();
    await this.disconnect();
    const args = ["db", "reset", "--linked", "--no-seed", "--yes"];
    if (version) args.push("--version", version);
    this.runSupabase(args);
    await this.connect();
    await this.assertSafety();
  }

  async repairMigration(version) {
    await this.assertSafety();
    this.runSupabase(["migration", "repair", "--linked", "--status", "applied", version, "--yes"]);
  }

  async migrateUp() {
    await this.assertSafety();
    this.runSupabase(["migration", "up", "--linked", "--include-all", "--yes"]);
  }

  async ensurePgTap() {
    await this.executeSql(
      "create extension if not exists pgtap with schema extensions",
      "pgTAP extension installation"
    );
  }

  async runPgTap() {
    await this.ensurePgTap();
    const testsDirectory = path.join(this.root, "supabase", "tests");
    const files = readdirSync(testsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    let assertions = 0;
    for (const file of files) {
      await this.assertSafety();
      await this.client.query("set search_path to public, extensions");
      let result;
      try {
        result = await this.client.query(readFileSync(path.join(testsDirectory, file), "utf8"));
      } catch (error) {
        await this.client.query("rollback").catch(() => {});
        throw new Error(`${file} failed: ${this.diagnostic(error.message)}`);
      }
      assertions += validatePgTapOutput(result, file);
      console.log(`PASS - ${file}`);
    }
    console.log(`Remote pgTAP pass succeeded: ${files.length} files / ${assertions} assertions.`);
    return { files: files.length, assertions };
  }

  sanitizedIdentity() {
    return {
      kind: "isolated Supabase test project",
      projectRefFingerprint: `sha256:${this.config.fingerprint}`,
      databaseName: this.pooler ? decodeURIComponent(this.pooler.pathname.slice(1)) : null,
      applicationOrigin: "verified non-production",
      credentialSource: "secure environment variables",
    };
  }

  async close() {
    await this.disconnect();
    if (this.tempRoot) {
      const resolved = path.resolve(this.tempRoot);
      const expectedPrefix = path.resolve(tmpdir()) + path.sep;
      if (
        resolved.startsWith(expectedPrefix) &&
        path.basename(resolved).startsWith("daybreak-db-test-")
      ) {
        rmSync(resolved, { recursive: true, force: true });
      }
      this.tempRoot = null;
    }
  }
}
