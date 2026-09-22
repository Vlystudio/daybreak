# Daybreak — historical launch/security checklist

> This checklist predates the Sections 1–8 implementation and is retained for
> context. Current status comes from
> `npm run verify:app-store-sections-1-8`,
> `docs/launch-readiness/sections-1-8-baseline.md`, and the evidence directories.
> Any unchecked or stale statement below must not override those sources.

This is the single source of truth for getting Daybreak from "working" to "safe to launch
publicly / submit to the App Store." Daybreak stores **special-category health data**, so this
bar is higher than a typical app: a public launch should be gated on a **professional penetration
test** and a **legal/privacy review** — neither of which can be substituted by code changes.

**Legend**

- ✅ Done — already implemented in the codebase.
- 🛠️ Code — implementable in this repo (Claude can do, then you review + preview-test).
- ⚙️ Platform — Supabase / Vercel / OpenAI / DNS dashboard config (you).
- 📋 Process/Legal — contracts, policies, audits (you + counsel).

> Risk note: items marked **[prod-risk]** can lock users out or corrupt data if shipped without a
> preview smoke-test. None should be force-pushed to `main`.

---

## A. Identity & access

### 1. Enforce MFA at login (AAL2) — 🛠️ [prod-risk]

Enrollment exists (`mfa-card.tsx`) but nothing checks the factor at sign-in, so 2FA is currently
cosmetic. Implementation: in `proxy.ts`, for authenticated users on protected routes, compare
`getAuthenticatorAssuranceLevel()` current vs next; if a verified factor exists and the session is
`aal1`, redirect to a `/login/mfa` challenge page (excluded from the redirect to avoid loops, with a
sign-out escape hatch). **Must be preview-tested** — a bug here locks out every MFA user.

### 2. Leaked-password protection + password policy — ⚙️

Supabase Dashboard → Authentication → Policies: enable **"Leaked password protection"** (HaveIBeenPwned),
set minimum length ≥ 10, and require character classes. Zero code.

### 3. Bot protection on auth + pre-auth rate limiting — ⚙️ + 🛠️

- Supabase Dashboard → Authentication → enable **CAPTCHA** (Cloudflare Turnstile); add the Turnstile
  site/secret keys; wire the widget into `auth-form.tsx` (🛠️).
- Add **edge/IP rate limiting** for unauthenticated routes (`/login`, `/api/oauth/*/start`,
  password reset) — Cloudflare/Vercel WAF rule or an IP-keyed variant of `rateLimit()`. Today's
  limiter is per-user and only runs _after_ login.

### 4. Anti-enumeration + enforced email verification — ⚙️

Supabase Dashboard → Authentication: turn on **"Confirm email"** (block app access until verified)
and **"Secure email change"**. Ensure signup/reset UI returns an identical message whether or not
the email exists (don't leak account existence).

### 5. Session hardening — ⚙️ + 🛠️ [prod-risk]

Dashboard: shorten the **JWT expiry** (e.g. 1h), enable **refresh-token rotation**. Code: a
"sign out of all devices" action and **re-authentication for sensitive actions** (delete account,
change email/password — wrap those server actions in a recent-login check).

### 6. OAuth flow hardening — 🛠️

Audit `/api/oauth/[provider]/start` + `/callback`: confirm a signed/verified **`state`** parameter,
**PKCE** where the provider supports it, a **strict redirect-URI allowlist**, and **minimum scopes**
for Oura/Google/Fitbit. Low risk; mostly verification + tightening.

---

## B. Data protection & compliance

### 7. Automated RLS / authorization tests — 🛠️ ← top launch-blocker

A misconfigured Row-Level-Security policy is the #1 breach vector for Supabase apps. Add a
**pgTAP** suite under `supabase/tests/` (run via `supabase test db`) asserting that user A cannot
read/write user B's `health_metrics`, `daily_summaries`, `schedule_events`, and the shared surfaces
(`households`, `friends`, `competitions`). Wire it into CI. Author now; runs against a test DB.

### 8. Encrypt + minimize sensitive health columns — 🛠️ + ⚙️ [prod-risk]

RLS protects rows but HRV/sleep/etc. are plaintext at rest. Options: Supabase **Vault / pgsodium**
column encryption for the most sensitive fields, plus **data minimization** — store and send to
OpenAI only what each feature needs. Requires a data migration; design key-versioned (see #15).

### 9. Subprocessor DPAs + data-flow map + AI opt-out — 📋 + 🛠️

You transmit health data to OpenAI. Required: a signed **Data Processing Agreement** with each
subprocessor (OpenAI, Supabase, Resend, Vercel), a documented **data-flow diagram**, and a
user-facing **consent + opt-out** for AI processing (🛠️ a toggle that disables AI features).

### 10. Regulatory posture & retention policy — 📋

Decide and document: "wellness" vs "medical" classification, GDPR special-category lawful basis,
whether US use triggers **HIPAA/BAAs**, and a **data-retention + auto-deletion schedule**. This
gates a real launch more than any single code change. Get counsel.

### 11. File-upload hardening — 🛠️

For the food/receipt/bird photo endpoints: validate the **actual image bytes** (magic numbers, not
just the `data:image/` prefix), enforce a **server-action body-size limit**, and **strip EXIF/GPS
metadata** server-side (re-encode via the already-present `sharp`). Defense-in-depth against
location leakage + malformed uploads. Additive and safe.

---

## C. Infrastructure & resilience

### 12. Backups + PITR + a _tested_ restore — ⚙️ + 📋

Supabase Dashboard → Database: enable **Point-in-Time Recovery** (Pro tier). Then actually run a
**restore drill** to a scratch project and document the runbook + RTO/RPO. Backups you've never
restored are not backups.

### 13. Staging environment + safe migrations — ⚙️ + 📋

Stand up a **staging Supabase + Vercel** mirror. Migrations: reviewed in PR, reversible, applied via
CI with a backup checkpoint — never hand-run against prod. (You currently apply migrations manually.)

### 14. Edge WAF + DDoS / bot mitigation — ⚙️

Put **Cloudflare** (or Vercel WAF/Firewall) in front: managed WAF ruleset, bot fight mode, and rate
rules on unauthenticated paths. Protects the surfaces your per-user limiter can't.

### 15. Secrets management + rotation + key versioning — 🛠️ + ⚙️ [prod-risk]

Design a rotation plan for `TOKEN_ENCRYPTION_KEY`, the service-role key, and `CRON_SECRET`. For the
encryption key specifically, move `crypto.ts` to **versioned/envelope encryption** (store a key id
with each ciphertext) so stored OAuth tokens can be re-keyed without downtime. Separate secrets per
environment.

### 16. Spend & anomaly guardrails — ⚙️ + 🛠️

- OpenAI Dashboard → Limits: hard **monthly budget cap** + alert (directly addresses your earlier
  cost spike). Same for Supabase + Vercel usage alerts.
- Code: alert when an account hits AI rate limits abnormally often (`[openai usage]` logs already
  give you the per-feature signal).

---

## D. Operations, trust & App Store

### 17. Monitoring + incident response — ⚙️ + 📋

Beyond Sentry (already wired): **uptime monitoring** (e.g. cron heartbeat + an external pinger),
alerting, periodic **audit-log review**, and a written **incident-response + breach-notification
plan** (legally required for health data in most jurisdictions — define who, what, and the 72h GDPR
clock).

### 18. Email domain security (SPF / DKIM / DMARC) — ⚙️ (DNS)

For your Resend sending domain, publish:

- **SPF**: `v=spf1 include:_spf.resend.com ~all`
- **DKIM**: the CNAME/TXT records Resend gives you in its dashboard.
- **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; fo=1` (tighten to `p=reject`
  after monitoring). Prevents briefing/digest spoofing and fixes deliverability.

### 19. UGC moderation & reporting — 🛠️ + 📋

Bird names, households, friends, and competitions are user-generated content. **Apple requires**
(Guideline 1.2) content filtering, a **report mechanism**, **block**, and acting on reports within
24h. Code: a profanity/length filter on free-text, a `reports` table + report action, and a basic
review path. Process: who triages reports.

### 20. Apple App Store readiness — 🛠️ + 📋

This is a Next.js web app — you first need a **wrapper** (Capacitor or a hardened PWA → iOS). Then:
**Privacy Manifest** (`PrivacyInfo.xcprivacy`) declaring data types + required-reason APIs, the App
**Privacy "nutrition labels,"** **Sign in with Apple** (mandatory if you offer Google/social login),
**ATS/HTTPS-only**, **ATT** prompt if you ever add tracking, and **account deletion** (✅ already
shipped). HealthKit entitlements only if you integrate it.

---

## Suggested order (highest leverage first)

1. **#7 RLS tests** + **#6 OAuth audit** + **#11 upload hardening** — pure code, safe, high value.
2. **#2, #4, #16, #18** — fast platform/DNS toggles, big risk reduction, ~an afternoon.
3. **#1 MFA enforcement** + **#5 session** + **#3 CAPTCHA** — code + config, **preview-test**.
4. **#12 backups/PITR** + **#13 staging** + **#14 WAF** — infrastructure.
5. **#9, #10, #17** — legal/privacy/IR (start early; they take wall-clock time with counsel).
6. **#8 column encryption** + **#15 key versioning** — the heaviest data migration; do last, carefully.
7. **#19, #20** — only if/when you go iOS.

**Do not launch a health-data product to the public without #7, #10, a backup restore drill (#12),
and an independent security review.**
