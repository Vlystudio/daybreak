import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SUPABASE_VERSION = "2.108.0";
const root = process.cwd();
const container = "supabase_db_daybreak-local";
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const npxCommand = process.platform === "win32" ? process.execPath : "npx";
const npxPrefix =
  process.platform === "win32"
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
    : [];
const supabase = (...args) => [
  ...npxPrefix,
  "--yes",
  `supabase@${SUPABASE_VERSION}`,
  ...args,
  "--workdir",
  root,
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    input: options.input,
    stdio: options.input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${options.label ?? command} failed (${result.error?.message ?? result.status}).`
    );
  }
}

function cli(...args) {
  run(npxCommand, supabase(...args), { label: `supabase ${args.join(" ")}` });
}

function sql(source, label) {
  run(
    docker,
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      input: source,
      label,
    }
  );
}

function migration(file) {
  return readFileSync(path.join(root, file), "utf8");
}

const userId = "91000000-0000-0000-0000-000000000021";
const insertLegacyUser = `
insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '${userId}', 'authenticated', 'authenticated',
  'upgrade-0021@example.invalid', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now()
);
`;

const insertSubjectiveRow = `
insert into public.subjective_checkins (user_id, date, mood, note)
values ('${userId}', '2026-07-20', 4, 'synthetic upgrade fixture');
`;

const partialSubjective = `
create table public.subjective_checkins (
  id uuid default gen_random_uuid(),
  user_id uuid,
  date date,
  mood smallint
);
insert into public.subjective_checkins (id, user_id, date, mood)
values (gen_random_uuid(), '${userId}', '2026-07-20', 4);
`;

function matrixAssertions(expectRow) {
  return `
do $$
declare
  policy_count integer;
begin
  if not exists (select 1 from auth.users where id = '${userId}') then
    raise exception 'legacy auth owner was lost';
  end if;
  if not exists (select 1 from public.profiles where id = '${userId}') then
    raise exception 'legacy profile ownership was lost';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='daily_summaries' and column_name='input_hash')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='fitness_plans' and column_name='input_hash') then
    raise exception 'input_hash reconciliation is incomplete';
  end if;
  if to_regclass('public.subjective_checkins') is null then
    raise exception 'subjective_checkins reconciliation is incomplete';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.subjective_checkins'::regclass) then
    raise exception 'subjective_checkins RLS is disabled';
  end if;
  select count(*) into policy_count from pg_policies
    where schemaname='public' and tablename='subjective_checkins'
      and policyname in ('subjective_checkins: read own','subjective_checkins: insert own','subjective_checkins: update own');
  if policy_count <> 3 then raise exception 'subjective_checkins policies are incomplete'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and tablename='subjective_checkins' and indexname='subjective_checkins_user_date_idx') then
    raise exception 'subjective_checkins index is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.subjective_checkins'::regclass and tgname='touch_subjective_checkins' and not tgisinternal) then
    raise exception 'subjective_checkins trigger is missing';
  end if;
  if (select count(*) from public.subjective_checkins where user_id='${userId}') <> ${expectRow ? 1 : 0} then
    raise exception 'subjective_checkins fixture was lost or duplicated';
  end if;
  if (select status from public.account_eligibility where user_id='${userId}') <> 'pending_adult_attestation' then
    raise exception 'pre-existing user was falsely made eligible';
  end if;
  if exists (select 1 from public.user_legal_acceptances where user_id='${userId}') then
    raise exception 'pre-existing user was falsely marked as accepting legal terms';
  end if;
  if exists (
    select 1 from public.user_preferences where user_id='${userId}' and
      (allow_ai_basic_processing or allow_ai_tasks_context or allow_ai_health_context or
       allow_ai_calendar_availability or allow_ai_calendar_detail or allow_ai_checkin_context or
       allow_ai_profile_context or allow_ai_uploads or ai_consent_version is not null)
  ) then raise exception 'AI consent was silently activated'; end if;
end $$;
`;
}

const legacyAi = migration("supabase/legacy-migrations/0021_ai_cache.sql");
const legacySubjective = migration("supabase/legacy-migrations/0021_subjective_checkins.sql");
const canonical = migration("supabase/migrations/0021_reconciled_legacy_bodies.sql");
const forward = migration("supabase/migrations/0048_reconcile_0021.sql");
const scenarios = [
  { id: "neither", sql: "", row: false },
  { id: "ai-cache-only", sql: legacyAi, row: false },
  { id: "subjective-only", sql: `${legacySubjective}\n${insertSubjectiveRow}`, row: true },
  { id: "both", sql: `${legacyAi}\n${legacySubjective}\n${insertSubjectiveRow}`, row: true },
  { id: "partial-subjective", sql: partialSubjective, row: true },
  {
    id: "canonical-already-applied",
    sql: `${canonical}\n${insertSubjectiveRow}`,
    row: true,
    repeatForward: true,
  },
];

const results = [];
for (const scenario of scenarios) {
  process.stdout.write(`\n=== duplicate-0021 scenario: ${scenario.id} ===\n`);
  cli("db", "reset", "--local", "--no-seed", "--version", "0020");
  sql(`${insertLegacyUser}\n${scenario.sql}`, `seed ${scenario.id}`);
  cli("migration", "repair", "--local", "--status", "applied", "0021");
  cli("migration", "up", "--local", "--include-all");
  sql(matrixAssertions(scenario.row), `assert ${scenario.id}`);
  if (scenario.repeatForward) {
    sql(forward, "repeat forward reconciliation");
    sql(matrixAssertions(true), "assert repeated reconciliation");
  }
  results.push({ scenario: scenario.id, status: "pass" });
}

process.stdout.write("\n=== representative pre-eligibility/privacy/AI upgrade ===\n");
cli("db", "reset", "--local", "--no-seed", "--version", "0048");
sql(
  `${insertLegacyUser}
update public.user_preferences set
  allow_ai_health_context=true,
  allow_ai_calendar_context=true,
  allow_ai_checkin_context=true,
  ai_consent_version='legacy-consent',
  ai_consent_updated_at=now()
where user_id='${userId}';
insert into public.daily_summaries (user_id,date,summary,input_hash) values ('${userId}','2026-07-21','synthetic summary',repeat('a',64));
insert into public.fitness_plans (user_id,summary,input_hash) values ('${userId}','synthetic plan',repeat('b',64));
insert into public.schedule_events (user_id,title,starts_at,ends_at) values ('${userId}','synthetic event',now(),now()+interval '1 hour');
insert into public.calendar_sync_settings (user_id,sync_enabled) values ('${userId}',true);
insert into public.oauth_connections (user_id,provider,access_token_enc) values ('${userId}','google','synthetic-encrypted-fixture');
insert into public.health_metrics (user_id,date,readiness_score) values ('${userId}','2026-07-21',75);
insert into public.health_observations (user_id,source,metric,value_numeric,date_local) values ('${userId}','manual','steps',1000,'2026-07-21');
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id,name,public) values ('launch-upgrade-fixture','launch-upgrade-fixture',false) on conflict do nothing;
    insert into storage.objects (bucket_id,name,owner_id) values ('launch-upgrade-fixture','${userId}/fixture.txt','${userId}') on conflict do nothing;
  end if;
end $$;`,
  "seed representative upgrade"
);
cli("migration", "up", "--local", "--include-all");
sql(
  `do $$
begin
  if (select status from public.account_eligibility where user_id='${userId}') <> 'pending_adult_attestation' then raise exception 'legacy user eligibility was elevated'; end if;
  if exists (select 1 from public.user_legal_acceptances where user_id='${userId}') then raise exception 'legacy legal acceptance was invented'; end if;
  if exists (select 1 from public.user_preferences where user_id='${userId}' and (allow_ai_basic_processing or allow_ai_tasks_context or allow_ai_health_context or allow_ai_calendar_context or allow_ai_calendar_availability or allow_ai_calendar_detail or allow_ai_checkin_context or allow_ai_profile_context or allow_ai_uploads or ai_consent_version is not null)) then raise exception 'legacy AI consent was inherited'; end if;
  if (select count(*) from public.daily_summaries where user_id='${userId}') <> 1
     or (select count(*) from public.fitness_plans where user_id='${userId}') <> 1
     or (select count(*) from public.schedule_events where user_id='${userId}') <> 1
     or (select count(*) from public.calendar_sync_settings where user_id='${userId}') <> 1
     or (select count(*) from public.oauth_connections where user_id='${userId}') <> 1
     or (select count(*) from public.health_metrics where user_id='${userId}') <> 1
     or (select count(*) from public.health_observations where user_id='${userId}') <> 1 then
    raise exception 'representative existing data was lost or reassigned';
  end if;
  if to_regclass('storage.objects') is not null and not exists (select 1 from storage.objects where bucket_id='launch-upgrade-fixture' and name='${userId}/fixture.txt') then raise exception 'existing storage object was lost'; end if;
end $$;`,
  "assert representative upgrade"
);
results.push({ scenario: "representative-pre-eligibility", status: "pass" });

process.stdout.write("\n=== pre-durable-deletion job upgrade ===\n");
cli("db", "reset", "--local", "--no-seed", "--version", "0049");
const deletionUser = "92000000-0000-0000-0000-000000000050";
sql(
  `insert into auth.users (id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
   values ('${deletionUser}','authenticated','authenticated','upgrade-deletion@example.invalid','',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"adult_attested":true,"adult_attestation_version":"2026-07-28","accepted_terms_version":"2026-07-28","acknowledged_privacy_version":"2026-07-28"}'::jsonb,now(),now());
   insert into public.account_deletion_jobs (id,user_id,reason,status,current_step,attempts,next_attempt_at)
   values ('92500000-0000-0000-0000-000000000050','${deletionUser}','user_request','pending','queued',0,now());`,
  "seed pre-0050 deletion job"
);
cli("migration", "up", "--local", "--include-all");
sql(
  `do $$ begin
    if not exists (select 1 from public.account_deletion_jobs where id='92500000-0000-0000-0000-000000000050' and user_id='${deletionUser}' and status='pending' and step_state='{}'::jsonb and provider_revocation='{}'::jsonb) then
      raise exception 'existing deletion job was corrupted';
    end if;
  end $$;`,
  "assert deletion job upgrade"
);
results.push({ scenario: "pre-durable-deletion-job", status: "pass" });

// Restore a clean head database for the pgTAP suite that follows this script.
cli("db", "reset", "--local", "--no-seed");

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  database: "disposable local Supabase only",
  supabaseCli: SUPABASE_VERSION,
  migrationRange: "0001-0053",
  historicalHashes: {
    "0021_ai_cache.sql": createHash("sha256").update(legacyAi).digest("hex"),
    "0021_subjective_checkins.sql": createHash("sha256").update(legacySubjective).digest("hex"),
  },
  results,
  sensitiveData: false,
};
const evidencePath = path.join(root, "build", "release-evidence", "database-upgrade-matrix.json");
mkdirSync(path.dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(
  `Database upgrade matrix passed; intermediate result written to ${path.relative(root, evidencePath)}.`
);
