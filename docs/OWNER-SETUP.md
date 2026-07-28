# Daybreak — Owner Setup & Launch Runbook

Everything **you** (the operator) need to do to take Daybreak live safely. The code
side is done and committed; this is the platform config, deployment, infra, legal,
and verification work that can't live in the repo.

Work top-to-bottom — it's ordered by dependency and urgency. Each task has: **why**,
**exact steps**, **values to use**, and a checkbox.

> **Reference**: your stack is Supabase (project ref `cybpuscssilbguypptxi`) + Vercel +
> Resend (email) + OpenAI + OAuth (Oura/Google/Fitbit). Dashboards change their wording
> occasionally; section names below are stable enough to find the setting.

---

## ⛔ Critical path (do NOT launch to real users without these)

These are the true blockers for a **health-data** product. Everything else hardens or
polishes; these are non-negotiable:

1. Phase 0 — ship the pending work + apply migration `0021` (below).
2. Phase 1 — Supabase auth hardening (email confirm, leaked-password, JWT).
3. Phase 4 — backups (PITR) **with a tested restore**.
4. Phase 6 — RLS isolation tests passing in CI.
5. Phase 7 — legal posture + privacy policy + subprocessor DPAs.
6. Phase 8 — an independent security review / pen test.
7. Cost caps (Phase 5) so a bug or abuse can't bankrupt you.

---

## Phase 0 — Ship what's already built (do first)

There are **4 unpushed commits** on your local `master` (which pushes to `origin/main`
= production on Vercel). They include two changes that **must be smoke-tested on a
preview before they hit prod**: the nonce-based CSP (every page now renders
dynamically) and MFA enrollment.

### 0.1 Apply the database migration — ⚠️ required

**Why**: the AI-cache code reads/writes an `input_hash` column added in
`supabase/migrations/0021_ai_cache.sql`. If the code is live but the column isn't there,
briefing/fitness-plan saves throw.

**Steps**:

```bash
# from the project root, against your PROD Supabase
supabase link --project-ref cybpuscssilbguypptxi   # if not already linked
supabase db push
```

It's additive (two nullable columns) — zero data risk, safe to run anytime.

- [ ] Migration `0021` applied to production DB.

### 0.2 Deploy to a PREVIEW first (don't push straight to prod)

**Why**: Vercel auto-deploys `main` to production. To validate CSP/MFA first, push to a
different branch so Vercel builds a preview URL.

**Steps**:

```bash
git push origin HEAD:preview-hardening     # creates a preview deploy in Vercel
```

Open the preview URL Vercel gives you, then run the smoke test (0.3).

- [ ] Preview deploy is live.

### 0.3 Smoke-test the preview (CSP + MFA + core flows)

Open the preview in a browser with **DevTools → Console** open and check:

**CSP** (the highest-risk change):

- [ ] Landing page `/`, `/login`, `/privacy`, `/terms` all render normally.
- [ ] **No `Content-Security-Policy` / "Refused to execute inline script" errors** in the console on any page.
- [ ] Dark/light theme still applies on first load (the inline theme script is nonce'd).
- [ ] Sign in, open the dashboard, navigate around — no blank pages, no console CSP errors.

**MFA** (Settings → Two-factor authentication):

- [ ] "Set up authenticator" shows a QR code; scanning + entering a code enables it.
- [ ] "Remove" disables it.

**Core**:

- [ ] Login, briefing loads, a photo upload (food/receipt/bird) works, no errors.

If anything CSP-related breaks, the fix is to revert `src/proxy.ts`, `next.config.ts`, and
the `layout.tsx` nonce change — it's isolated and safe to roll back.

### 0.4 Promote to production

Once the preview is clean:

```bash
git push origin HEAD:main      # production deploy
```

- [ ] Production deployed and re-smoke-tested.
- [ ] Delete the preview branch when done: `git push origin --delete preview-hardening`.

---

## Phase 1 — Supabase auth hardening (fast, high impact)

All in **Supabase Dashboard → Authentication**. ~30 minutes, no code.

### 1.1 Require email confirmation

**Why**: stops account takeover via unverified emails and blocks throwaway-email abuse.
**Where**: Authentication → **Sign In / Providers → Email** → enable **"Confirm email"**.
Also enable **"Secure email change"** (requires confirming both old + new address).

- [ ] Confirm email ON. Secure email change ON.

### 1.2 Leaked-password protection + password policy

**Why**: blocks passwords known to be breached (HaveIBeenPwned) and weak passwords —
your #1 defense against credential stuffing.
**Where**: Authentication → **Policies / Password** → enable **"Leaked password
protection"**; set **Minimum password length** ≥ 10; require at least lower+upper+digit.

- [ ] Leaked-password protection ON. Min length ≥ 10. Complexity ON.

### 1.3 Session / JWT settings

**Why**: shorter tokens + rotation shrink the window a stolen token is useful.
**Where**: Authentication → **Sessions** (and Settings):

- Set **Access token (JWT) expiry** to `3600` (1 hour).
- Enable **Refresh token rotation** + **reuse detection**.
- (Optional) Set an **inactivity timeout** / max session lifetime for a health app.

- [ ] JWT expiry 1h. Refresh rotation + reuse detection ON.

### 1.4 Bot protection (CAPTCHA) on auth

**Why**: stops automated signup/login/credential-stuffing.
**Steps**:

1. Create a free **Cloudflare Turnstile** site (https://dash.cloudflare.com → Turnstile);
   note the **Site key** + **Secret key**.
2. Supabase → Authentication → **Bot and Abuse Protection** → enable **CAPTCHA**, choose
   **Turnstile**, paste the **Secret key**.
3. Tell me the **Site key** and I'll wire the Turnstile widget into the login form (code).

- [ ] Turnstile created. Supabase CAPTCHA ON. Site key handed to me for the widget.

### 1.5 MFA settings

**Why**: you ship MFA enrollment; make sure the project allows TOTP factors.
**Where**: Authentication → **Multi-Factor** → ensure **TOTP** is enabled, set a sensible
**max enrolled factors** (e.g. 2).

- [ ] TOTP MFA enabled at the project level.

> Note: enforcing MFA **at login** (AAL2) is a code change I flagged as prod-risk — we'll
> do it as its own preview-tested batch when you're ready.

---

## Phase 2 — Secrets & environment

### 2.1 Confirm production env vars in Vercel

**Where**: Vercel → Project → **Settings → Environment Variables** (Production scope).
These must all be present (the app validates them at boot):

| Variable                                                                        | Notes                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                                                      | your Supabase URL                                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                 | anon key (safe public)                                                   |
| `NEXT_PUBLIC_APP_URL`                                                           | the production URL (used for OAuth redirects)                            |
| `SUPABASE_SERVICE_ROLE_KEY`                                                     | **secret** — server only                                                 |
| `TOKEN_ENCRYPTION_KEY`                                                          | 32-byte base64 — **never rotate casually** (see 2.3)                     |
| `CRON_SECRET`                                                                   | protects the cron endpoints                                              |
| `ADMIN_ACTION_SECRET`                                                           | protects high-impact admin/support actions; do not reuse the cron secret |
| `OPENAI_API_KEY`                                                                |                                                                          |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                  | email                                                                    |
| `OURA_*`, `GOOGLE_*`, `FITBIT_*`                                                | OAuth (only those you use)                                               |
| `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                             | web push                                                                 |
| `WEATHER_API_KEY`, `SPOONACULAR_API_KEY`, `LOGMEAL_API_KEY`, `GROCERYTRACKER_*` | optional                                                                 |

- [ ] All required vars present in Production (and Preview, if you preview-deploy).

### 2.2 Add the Sentry DSN (turns on error monitoring)

**Why**: the code reports errors to Sentry but no-ops without a DSN.
**Steps**:

1. Create a Sentry project (https://sentry.io → New Project → **Next.js**). Copy the **DSN**.
2. Vercel env var: `NEXT_PUBLIC_SENTRY_DSN = https://...ingest.sentry.io/...` (Production + Preview).
3. Redeploy. Trigger a test error and confirm it appears in Sentry.

- [ ] Sentry project created, DSN set, a test error received.

### 2.3 Plan key rotation (the code now supports it)

**Why**: `TOKEN_ENCRYPTION_KEY` encrypts stored OAuth tokens. The code now supports
zero-downtime rotation. You don't need to rotate now, but document the procedure:

1. Generate a new key: `openssl rand -base64 32`.
2. Set `TOKEN_ENCRYPTION_KEYS={"k1":"<newKeyBase64>"}` and `TOKEN_ENCRYPTION_ACTIVE_KEY=k1`.
3. Deploy. New/refreshed tokens encrypt with `k1`; old tokens still decrypt with the
   original key. Over time (token refreshes) everything migrates to `k1`.
4. Rotate `CRON_SECRET` and the Supabase service-role key on a schedule too (these are
   simple env swaps + a redeploy).

- [ ] Rotation procedure documented; schedule set (e.g. every 6–12 months).

---

## Phase 3 — Email deliverability & anti-spoofing (DNS)

**Why**: without this, briefings/digests land in spam and anyone can spoof your domain.
All records go in your domain's DNS (registrar or Cloudflare).

**Steps**:

1. Resend → **Domains** → add your sending domain → Resend shows **DKIM** (CNAME/TXT) +
   a return-path record. Add them exactly as shown; wait for "Verified."
2. Add **SPF** (TXT on the root or sending subdomain):
   `v=spf1 include:_spf.resend.com ~all`
3. Add **DMARC** (TXT at `_dmarc.yourdomain.com`):
   `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; fo=1`
   Start at `p=quarantine`, watch the `rua` reports for a couple weeks, then tighten to
   `p=reject`.
4. Set `EMAIL_FROM` to a verified address on that domain.

- [ ] DKIM verified in Resend. SPF added. DMARC added. `EMAIL_FROM` on the verified domain.

---

## Phase 4 — Backups, disaster recovery & staging

### 4.1 Point-in-Time Recovery + a _tested_ restore — ⛔ launch blocker

**Why**: a bad migration or deletion without a proven restore = permanent data loss of
people's health data.
**Steps**:

1. Supabase → **Database → Backups** → enable **Point-in-Time Recovery** (requires Pro).
2. **Actually run a restore drill**: restore to a _scratch_ project, confirm data is
   intact, time it. Write down the steps + your **RTO/RPO** (how fast, how much data loss
   is acceptable).

- [ ] PITR enabled. Restore drill completed and documented.

### 4.2 Staging environment

**Why**: so you never test migrations against production.
**Steps**:

1. Create a **second Supabase project** (staging) + a Vercel **preview/staging** env
   pointing at it.
2. Apply migrations to staging first; only promote to prod after they pass there + RLS
   tests pass.

- [ ] Staging Supabase + Vercel env exist. Migration flow is staging → prod.

---

## Phase 5 — Cost controls & edge protection

### 5.1 Spend caps (do this early — cheap insurance)

**Why**: a loop or abuse spike shouldn't produce a surprise bill.

- **OpenAI** → Settings → **Limits**: set a hard **monthly budget** + an email alert
  threshold.
- **Supabase** → Organization → **Billing**: set a **spend cap**.
- **Vercel** → **Usage / Spend Management**: set alerts.

- [ ] OpenAI budget cap + alert. Supabase spend cap. Vercel alerts.

### 5.2 Edge WAF / DDoS / bot mitigation

**Why**: your in-app rate limiting only runs _after_ auth; you need protection at the edge
for unauthenticated traffic (login, signup, OAuth start).
**Steps** (pick one):

- **Cloudflare** in front of the domain: enable the **Managed WAF ruleset**, **Bot Fight
  Mode**, and a **rate-limiting rule** on `/login`, `/api/oauth/*`, and password reset.
- Or **Vercel Firewall/WAF** (if on a plan that includes it): enable managed rules +
  rate rules on the same paths.

- [ ] WAF/managed rules enabled. Rate rules on unauthenticated paths.

---

## Phase 6 — Verification (run before every release)

### 6.1 Stand up the RLS tests — ⛔ launch blocker

**Why**: proves no user can read another user's health data. This is the single most
important safety check.
**Steps** (one-time setup):

1. Install the Supabase test helpers (https://github.com/usebasejump/supabase-test-helpers)
   into your local/test DB (see `supabase/tests/README.md`).
2. Run them:

   ```bash
   supabase start
   npm run test:db          # runs supabase/tests/*.sql via pgTAP
   ```

3. Confirm all isolation assertions pass. The CI workflow already runs typecheck/lint/unit
   tests; add `npm run test:db` to CI once you have a DB step in the pipeline.

- [ ] RLS tests pass locally. Wired into CI.

### 6.2 Generate typed DB client

**Why**: end-to-end type safety against schema drift (I couldn't run this from the sandbox).
**Steps**:

```bash
SUPABASE_ACCESS_TOKEN=<your-token> npm run gen:types
```

This writes `src/lib/supabase/database.types.ts`. Hand it back to me and I'll wire
`createClient<Database>()` across the data layer.

- [ ] `gen:types` run; types committed; client wired (I'll do the wiring).

### 6.3 Uptime & cron monitoring

**Why**: know when the site is down or a cron silently stops.
**Steps**:

- Add an external uptime monitor (e.g. UptimeRobot/BetterStack) hitting the homepage.
- Add a **cron heartbeat**: have the daily/hourly crons ping a monitor (e.g. a
  healthchecks.io URL) so a missed run alerts you.

- [ ] Uptime monitor live. Cron heartbeat alerts configured.

---

## Phase 7 — Legal & compliance (start NOW — long lead time)

You store **special-category health data**. This is the part that genuinely gates a public
launch and takes weeks, so begin in parallel with the technical work. **Get a lawyer** for
anything below.

### 7.1 Regulatory posture

Decide and document, with counsel:

- Is Daybreak **"wellness"** or **"medical"**? (Affects FDA/medical-device exposure in the US.)
- **GDPR** (any EU users): lawful basis for processing special-category data — almost
  certainly **explicit consent**.
- **US**: are you a HIPAA "covered entity"/"business associate"? If so you need **BAAs**
  with subprocessors.
- A **data-retention + auto-deletion schedule** (how long you keep health data).

- [ ] Classification + lawful basis documented. Retention policy written.

### 7.2 Subprocessor DPAs + data-flow map

You transmit health data to third parties. Sign a **Data Processing Agreement** with each:

- **OpenAI** (briefings/analysis), **Supabase** (storage), **Resend** (email), **Vercel**
  (hosting), and any others (LogMeal, weather, Spoonacular).
- Draw a **data-flow diagram**: what data leaves the app, to whom, for what.
- Add a user-facing **AI opt-out/consent** (I can build the toggle; the policy is yours).

- [ ] DPAs signed with all subprocessors. Data-flow map written. AI consent decided.

### 7.3 Public-facing policies

- A **Privacy Policy** that names every subprocessor, the data collected, retention, and
  user rights (export/delete — already built into the app).
- **Terms of Service**.
- A **cookie/consent** notice if required for your regions.

- [ ] Privacy Policy + ToS published and linked (you have `/privacy` and `/terms` routes).

### 7.4 Incident response & breach notification

**Why**: legally required for health data (GDPR's 72-hour clock; US state breach laws).
Write a one-pager: **who** is on call, **how** you detect (Sentry + uptime), **what** you do
in the first hour, and **how/when** you notify users + regulators.

- [ ] Incident-response + breach-notification plan written. On-call named.

---

## Phase 8 — Security review (before launch)

### 8.1 Independent penetration test

**Why**: you cannot self-attest security for a health app. Hire a reputable firm (or a
vetted freelancer) to test auth, RLS/IDOR, the OAuth flows, and the AI/upload endpoints.
Budget 1–3 weeks lead time.

- [ ] Pen test booked. Findings triaged and fixed.

### 8.2 Vulnerability disclosure

- Publish a `/.well-known/security.txt` with a contact + policy.
- Decide on a disclosure/bug-bounty posture.

- [ ] `security.txt` published. Disclosure policy decided.

### 8.3 Dependency hygiene

- Dependabot is configured (PRs will arrive). Triage and merge them.
- Run `npm audit` periodically; the 2 current moderate advisories should be reviewed.

- [ ] Dependabot PRs flowing and triaged. `npm audit` clean or accepted.

---

## Phase 9 — Apple App Store (only if you go iOS)

This is a Next.js web app; the App Store needs a native shell.

### 9.1 Wrapper

- Wrap the PWA with **Capacitor** (recommended) or ship a hardened PWA. This is a real
  project (Xcode, an Apple Developer account at $99/yr, signing certs).

### 9.2 Apple requirements (Guideline-gated — they WILL reject without these)

- **Account deletion** in-app — ✅ already built (Settings → Data & privacy).
- **App Privacy "nutrition labels"** — declare every data type you collect (health, etc.).
- **Privacy Manifest** (`PrivacyInfo.xcprivacy`) — declare data types + required-reason APIs.
- **Sign in with Apple** — **mandatory** if you offer Google/social login.
- **UGC moderation + reporting + block** — required because bird names/households/friends
  are user-generated. (I can build the moderation/report code; you define the review
  process and 24-hour response.)
- **ATS** (HTTPS only) — already the case.
- **ATT** prompt — only if you ever add cross-app tracking (you don't today).

- [ ] Wrapper built. Privacy manifest + labels done. Sign in with Apple added (if needed).
      UGC moderation shipped. Submitted.

---

## Quick reference — what to hand back to me (code follow-ups)

When you've done the relevant config, send me:

- **Turnstile Site key** → I wire the CAPTCHA widget.
- **`database.types.ts`** (from `npm run gen:types`) → I wire the typed Supabase client.
- A **"go" for the prod-risk batch** → I implement MFA-at-login enforcement (#1) and
  session re-auth / sign-out-everywhere (#5), for you to preview-test.
- A **"go" for the feature batch** → I implement UGC moderation + reporting (#19) and the
  AI opt-out toggle (#9), each with its migration for you to apply.
