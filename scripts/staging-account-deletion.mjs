import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "cybpuscssilbguypptxi";
const PRODUCTION_APP_HOST = "daybreak-one.vercel.app";
const root = process.cwd();
const privateStatePath = path.join(
  root,
  "build",
  "release-evidence",
  "staging-account-deletion.private.json"
);
const evidencePath = path.join(
  root,
  "docs",
  "launch-readiness",
  "evidence",
  "04-auth-and-accounts",
  "staging-account-deletion.json"
);

function fail(message) {
  console.error(`Staging deletion harness stopped: ${message}`);
  process.exit(1);
}

const command = process.argv[2];
if (!new Set(["seed", "test", "verify"]).has(command)) {
  fail("use exactly one command: seed, test, or verify.");
}
if (process.argv.length !== 3) fail("unexpected arguments are forbidden.");

const required = [
  "STAGING_SUPABASE_URL",
  "STAGING_SUPABASE_ANON_KEY",
  "STAGING_SUPABASE_SERVICE_ROLE_KEY",
  "STAGING_TEST_PASSWORD",
  "STAGING_APP_URL",
  "STAGING_CRON_SECRET",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) fail(`missing required staging variables: ${missing.join(", ")}.`);
if (process.env.STAGING_ENVIRONMENT_ACK !== "isolated-staging") {
  fail("set STAGING_ENVIRONMENT_ACK=isolated-staging after confirming the target is disposable.");
}

let supabaseUrl;
let appUrl;
try {
  supabaseUrl = new URL(process.env.STAGING_SUPABASE_URL);
  appUrl = new URL(process.env.STAGING_APP_URL);
} catch {
  fail("staging URLs are invalid.");
}
if (supabaseUrl.protocol !== "https:" || appUrl.protocol !== "https:") {
  fail("staging endpoints must use HTTPS.");
}
const stagingRef = supabaseUrl.hostname.split(".")[0];
if (
  stagingRef === PRODUCTION_PROJECT_REF ||
  supabaseUrl.hostname.includes(PRODUCTION_PROJECT_REF) ||
  appUrl.hostname === PRODUCTION_APP_HOST
) {
  fail("the configured target matches a known production endpoint; no request was sent.");
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const admin = createClient(
  process.env.STAGING_SUPABASE_URL,
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
  clientOptions
);
const browser = createClient(
  process.env.STAGING_SUPABASE_URL,
  process.env.STAGING_SUPABASE_ANON_KEY,
  clientOptions
);

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function readState() {
  if (!existsSync(privateStatePath)) {
    fail("private state is absent; run npm run staging:seed-deletion-user first.");
  }
  try {
    return JSON.parse(readFileSync(privateStatePath, "utf8"));
  } catch {
    fail("private state is invalid; remove it and seed a fresh fixture.");
  }
}

function writeState(state) {
  mkdirSync(path.dirname(privateStatePath), { recursive: true });
  writeFileSync(privateStatePath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function expect(operation, resource) {
  const result = await operation;
  if (result.error) fail(`${resource} operation failed (${result.error.code ?? "remote_error"}).`);
  return result.data;
}

async function seed() {
  if (existsSync(privateStatePath)) {
    fail(
      "private state already exists; verify or securely remove the prior synthetic fixture first."
    );
  }
  const runId = randomUUID();
  const userEmail = `daybreak-deletion-${runId}@example.invalid`;
  const controlEmail = `daybreak-control-${runId}@example.invalid`;
  const metadata = {
    display_name: "Synthetic deletion fixture",
    adult_attested: true,
    adult_attestation_version: "2026-07-28",
    accepted_terms_version: "2026-07-28",
    acknowledged_privacy_version: "2026-07-28",
  };
  const created = await admin.auth.admin.createUser({
    email: userEmail,
    password: process.env.STAGING_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (created.error || !created.data.user) fail("synthetic Auth user creation failed.");
  const control = await admin.auth.admin.createUser({
    email: controlEmail,
    password: process.env.STAGING_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { ...metadata, display_name: "Synthetic control fixture" },
  });
  if (control.error || !control.data.user) fail("synthetic control Auth user creation failed.");
  const userId = created.data.user.id;
  const controlUserId = control.data.user.id;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  await expect(
    admin.from("user_preferences").upsert({
      user_id: userId,
      onboarding_completed: true,
      planning_scope: "few_days",
      allow_ai_basic_processing: true,
      allow_ai_tasks_context: true,
      allow_ai_checkin_context: true,
      allow_ai_health_context: true,
      allow_ai_calendar_context: true,
      allow_ai_calendar_availability: true,
      allow_ai_calendar_detail: true,
      allow_ai_profile_context: true,
      allow_ai_uploads: false,
      ai_consent_version: "2026-07-28",
      ai_consent_updated_at: new Date().toISOString(),
      ai_consent_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }),
    "preferences"
  );
  await expect(
    admin.from("account_eligibility").update({ consent_epoch: 1 }).eq("user_id", userId),
    "consent epoch"
  );
  const fixtures = [
    [
      "schedule_events",
      {
        user_id: userId,
        title: "Synthetic deletion task",
        starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      },
    ],
    ["fitness_plans", { user_id: userId, summary: "Synthetic plan", input_hash: "a".repeat(64) }],
    ["subjective_checkins", { user_id: userId, date: today, mood: 4, note: "Synthetic check-in" }],
    [
      "health_checkins",
      {
        user_id: userId,
        messages: [
          { role: "assistant", content: "Synthetic prompt", at: new Date().toISOString() },
          { role: "user", content: "Synthetic response", at: new Date().toISOString() },
        ],
      },
    ],
    [
      "health_observations",
      {
        user_id: userId,
        source: "manual",
        metric: "steps",
        value_numeric: 1234,
        date_local: today,
        metadata: { fixture: true },
      },
    ],
    [
      "daily_summaries",
      {
        user_id: userId,
        date: tomorrow,
        summary: "Synthetic derived wellness summary",
        input_hash: "b".repeat(64),
      },
    ],
    ["calendar_sync_settings", { user_id: userId, sync_enabled: true }],
    [
      "ai_consent_history",
      {
        user_id: userId,
        consent_version: "2026-07-28",
        consent_epoch: 1,
        event_type: "decision_recorded",
        choices: { basic: true, tasks: true, checkin: true, health: true, calendarDetail: true },
        application_version: "staging-harness-1",
        platform: "web",
      },
    ],
    [
      "ai_processing_permits",
      {
        user_id: userId,
        purpose: "daily_plan",
        allowed_categories: [
          "basic",
          "tasks",
          "health",
          "calendar_availability",
          "calendar_detail",
        ],
        consent_version: "2026-07-28",
        consent_epoch: 1,
        nonce_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        max_uses: 8,
        expires_at: new Date(Date.now() + 7_200_000).toISOString(),
      },
    ],
    [
      "push_subscriptions",
      {
        user_id: userId,
        endpoint: `https://push.example.invalid/${runId}`,
        p256dh: "synthetic-public-key",
        auth: "synthetic-auth-secret",
      },
    ],
    [
      "privacy_rights_requests",
      {
        user_id: userId,
        request_type: "access",
        scope: "all_personal_data",
        jurisdiction_code: "US",
        deadline_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
    ],
  ];
  for (const [table, row] of fixtures) await expect(admin.from(table).insert(row), table);
  const controlEventId = randomUUID();
  await expect(
    admin.from("schedule_events").insert({
      id: controlEventId,
      user_id: controlUserId,
      title: "Unrelated synthetic control",
      starts_at: new Date(Date.now() + 10_800_000).toISOString(),
      ends_at: new Date(Date.now() + 14_400_000).toISOString(),
    }),
    "control event"
  );
  await expect(
    admin.storage
      .from("avatars")
      .upload(`${userId}/deletion-fixture.txt`, new TextEncoder().encode("synthetic fixture"), {
        contentType: "text/plain",
        upsert: false,
      }),
    "storage fixture"
  );

  writeState({
    schemaVersion: 1,
    stagingRefFingerprint: fingerprint(stagingRef),
    runId,
    userId,
    userEmail,
    controlUserId,
    controlEventId,
    seededAt: new Date().toISOString(),
    seededResources: fixtures.map(([table]) => table).concat("storage.objects"),
  });
  console.log(
    "Synthetic staging fixture created. Connect real provider grants through the staging UI now if provider-side proof is in scope, then run npm run staging:test-account-deletion."
  );
}

function runInternalFailureTests() {
  const npx = process.platform === "win32" ? process.execPath : "npx";
  const prefix =
    process.platform === "win32"
      ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
      : [];
  const result = spawnSync(
    npx,
    [
      ...prefix,
      "vitest",
      "run",
      "src/lib/integrations/tokens.test.ts",
      "src/lib/account-deletion.test.ts",
    ],
    { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" }
  );
  return result.status === 0 && !result.error;
}

async function statusForHash(statusHash) {
  const job = await admin
    .from("account_deletion_jobs")
    .select(
      "status,current_step,attempts,next_attempt_at,last_error_class,last_error_code,provider_revocation"
    )
    .eq("status_token_hash", statusHash)
    .maybeSingle();
  if (job.error) fail("deletion job status lookup failed.");
  if (job.data) return { kind: "job", ...job.data };
  const receipt = await admin
    .from("account_deletion_receipts")
    .select("status,requested_at,completed_at,step_summary")
    .eq("status_token_hash", statusHash)
    .maybeSingle();
  if (receipt.error) fail("deletion receipt lookup failed.");
  return receipt.data ? { kind: "receipt", ...receipt.data } : null;
}

async function testDeletion() {
  const state = readState();
  const authenticated = await browser.auth.signInWithPassword({
    email: state.userEmail,
    password: process.env.STAGING_TEST_PASSWORD,
  });
  if (authenticated.error || authenticated.data.user?.id !== state.userId) {
    fail("synthetic user authentication failed.");
  }
  const reauthenticated = await browser.auth.signInWithPassword({
    email: state.userEmail,
    password: process.env.STAGING_TEST_PASSWORD,
  });
  if (reauthenticated.error || reauthenticated.data.user?.id !== state.userId) {
    fail("synthetic user reauthentication failed.");
  }

  const providersBefore = await expect(
    admin.from("oauth_connections").select("provider").eq("user_id", state.userId),
    "provider fixture inspection"
  );
  const statusToken = randomBytes(32).toString("base64url");
  const statusHash = createHash("sha256").update(statusToken).digest("hex");
  const queued = await admin.rpc("queue_account_deletion_job", {
    p_user_id: state.userId,
    p_reason: "user_request",
    p_status_token_hash: statusHash,
  });
  if (queued.error || typeof queued.data !== "string") fail("trusted deletion queue failed.");
  const internalFailureTestsPassed = runInternalFailureTests();
  if (!internalFailureTestsPassed) fail("internal provider retry/order tests failed.");

  const response = await fetch(new URL("/api/cron/account-deletion", appUrl), {
    headers: { Authorization: `Bearer ${process.env.STAGING_CRON_SECRET}` },
    redirect: "error",
  });
  if (!response.ok) fail(`staging deletion worker returned HTTP ${response.status}.`);

  let observed = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    observed = await statusForHash(statusHash);
    if (
      observed?.status === "completed" ||
      observed?.status === "retry_wait" ||
      observed?.status === "blocked"
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  if (!observed) fail("opaque deletion receipt could not be resolved.");
  writeState({
    ...state,
    jobId: queued.data,
    statusToken,
    statusHash,
    testedAt: new Date().toISOString(),
    providersBefore: (providersBefore ?? []).map(({ provider }) => provider),
    internalFailureTestsPassed,
    observedStatus: observed,
  });
  if (observed.status !== "completed") {
    fail(
      `deletion is ${observed.status} at ${observed.current_step ?? "worker"}; encrypted credentials and Auth remain fail-closed for retry. Re-run after the staged fault clears.`
    );
  }
  const loginAfter = await browser.auth.signInWithPassword({
    email: state.userEmail,
    password: process.env.STAGING_TEST_PASSWORD,
  });
  if (!loginAfter.error) fail("deleted synthetic user can still authenticate.");
  console.log(
    "Deletion completed and authentication now fails. Run npm run staging:verify-deletion-residue to produce sanitized evidence."
  );
}

const directOwnership = [
  ["profiles", "id"],
  ["user_preferences", "user_id"],
  ["account_eligibility", "user_id"],
  ["user_legal_acceptances", "user_id"],
  ["health_metrics", "user_id"],
  ["daily_summaries", "user_id"],
  ["schedule_events", "user_id"],
  ["calendar_sync_settings", "user_id"],
  ["subjective_checkins", "user_id"],
  ["health_checkins", "user_id"],
  ["food_logs", "user_id"],
  ["water_logs", "user_id"],
  ["body_measurements", "user_id"],
  ["evening_reviews", "user_id"],
  ["habits", "user_id"],
  ["goals", "user_id"],
  ["reminders", "user_id"],
  ["health_workouts", "user_id"],
  ["health_daily_samples", "user_id"],
  ["apple_health_imports", "user_id"],
  ["health_observations", "user_id"],
  ["fitness_plans", "user_id"],
  ["oauth_connections", "user_id"],
  ["notification_settings", "user_id"],
  ["push_subscriptions", "user_id"],
  ["audit_logs", "user_id"],
  ["analytics_events", "user_id"],
  ["ai_consent_history", "user_id"],
  ["ai_processing_permits", "user_id"],
  ["privacy_rights_requests", "user_id"],
  ["account_deletion_jobs", "user_id"],
];

async function countRows(table, column, value) {
  const result = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (result.error) fail(`${table} residue query failed (${result.error.code ?? "remote_error"}).`);
  return result.count ?? -1;
}

async function verify() {
  const state = readState();
  if (!state.statusToken || state.observedStatus?.status !== "completed") {
    fail("completed test state is absent; run npm run staging:test-account-deletion first.");
  }
  const residue = {};
  for (const [table, column] of directOwnership) {
    residue[`${table}.${column}`] = await countRows(table, column, state.userId);
  }
  for (const [table, first, second] of [
    ["friendships", "requester_id", "addressee_id"],
    ["nudges", "from_user_id", "to_user_id"],
  ]) {
    const result = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .or(`${first}.eq.${state.userId},${second}.eq.${state.userId}`);
    if (result.error) fail(`${table} relationship residue query failed.`);
    residue[`${table}.both_sides`] = result.count ?? -1;
  }
  const authUser = await admin.auth.admin.getUserById(state.userId);
  residue["auth.users.id"] = authUser.data.user ? 1 : 0;
  const cache = await admin.from("ai_generation_cache").select("*", { count: "exact", head: true });
  if (cache.error) fail("AI cache residue query failed.");
  residue["ai_generation_cache.all"] = cache.count ?? -1;

  let storageResidue = 0;
  const buckets = await admin.storage.listBuckets();
  if (buckets.error) fail("storage bucket inventory failed.");
  for (const bucket of buckets.data ?? []) {
    for (const prefix of [state.userId, `users/${state.userId}`]) {
      const listed = await admin.storage.from(bucket.name).list(prefix, { limit: 1 });
      if (listed.error) fail("storage residue lookup failed.");
      storageResidue += listed.data?.length ?? 0;
    }
    const roots = await admin.storage
      .from(bucket.name)
      .list("", { limit: 100, search: state.userId });
    if (roots.error) fail("storage root residue lookup failed.");
    storageResidue += roots.data?.filter(({ name }) => name.includes(state.userId)).length ?? 0;
  }
  residue["storage.addressed_objects"] = storageResidue;

  const controlAuth = await admin.auth.admin.getUserById(state.controlUserId);
  const controlEvent = await countRows("schedule_events", "id", state.controlEventId);
  const unrelatedUserUnchanged = Boolean(controlAuth.data.user) && controlEvent === 1;
  const receipt = await statusForHash(state.statusHash);
  const receiptComplete = receipt?.kind === "receipt" && receipt.status === "completed";
  const providerSummary = receipt?.step_summary?.providerRevocation ?? {};
  const providers = state.providersBefore ?? [];
  const providerDispatchConfirmed = providers.every((provider) =>
    new Set(["revoked", "already_invalid"]).has(providerSummary?.[provider]?.status)
  );
  const zeroResidue = Object.values(residue).every((count) => count === 0);
  const providerSideProof =
    providers.length > 0 && providerDispatchConfirmed
      ? "dispatch_confirmed_refresh_invalidation_external"
      : "blocked_no_real_staging_provider_grants";
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
    environment: "isolated staging",
    targetFingerprint: state.stagingRefFingerprint,
    syntheticSubjectFingerprint: fingerprint(state.userId),
    containsRealUserData: false,
    flow: {
      authenticated: true,
      reauthenticated: true,
      deletionQueued: true,
      opaqueReceiptCaptured: true,
      workerTriggered: true,
      statusPolled: true,
      completed: receiptComplete,
      authenticationRejectedAfterDeletion: true,
      internalRetryAndOrderingTests: state.internalFailureTestsPassed === true,
    },
    providerRevocation: {
      configuredProviders: providers,
      dispatchConfirmed: providerDispatchConfirmed,
      refreshInvalidation: "blocked_pending_owner-supplied_provider_evidence",
      status: providerSideProof,
    },
    residue,
    zeroResidue,
    unrelatedUserUnchanged,
    subscriptionState: "not_applicable_free_v1",
    supportPlatformState: "not_applicable_no_support_platform",
    verdict:
      zeroResidue &&
      unrelatedUserUnchanged &&
      receiptComplete &&
      providers.length > 0 &&
      providerDispatchConfirmed
        ? "technical_deletion_pass_provider_refresh_proof_blocked"
        : zeroResidue && unrelatedUserUnchanged && receiptComplete
          ? "technical_deletion_pass_provider_grant_proof_blocked"
          : "fail",
  };
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (!zeroResidue || !unrelatedUserUnchanged || !receiptComplete) {
    fail("residue verification failed; sanitized evidence records the failure.");
  }
  unlinkSync(privateStatePath);
  console.log(
    `Technical staging deletion passed; sanitized evidence written to ${path.relative(root, evidencePath)}. Provider refresh invalidation remains externally blocked.`
  );
}

if (command === "seed") await seed();
if (command === "test") await testDeletion();
if (command === "verify") await verify();
