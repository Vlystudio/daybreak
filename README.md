# Daybreak ☀️

> Good morning. Here's how you're doing today — and how to make the most of your day.

Daybreak is a morning wellness companion that gathers your **Oura** sleep/readiness/HRV data,
**Google Calendar**, local **weather**, and an **AI morning briefing** into one calm, warm
dashboard — with a manual schedule editor and a shared household view.

## Stack

- **Frontend**: Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style components · Framer Motion · Recharts · React Big Calendar · React Hook Form + Zod
- **Backend**: Next.js Server Actions & Route Handlers · Supabase (Postgres, Auth, RLS) · OpenAI API · Oura API v2 · Google Calendar API · Open-Meteo weather
- **Infra**: Vercel + Vercel Cron Jobs

## Getting started

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration: paste `supabase/migrations/0001_init.sql` into the SQL editor
   (or `supabase db push` with the CLI).
3. In **Authentication → Providers**, enable Email. For local dev you may want to disable
   "Confirm email" so sign-ups are instant.

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in (a `.env.local` with generated
`TOKEN_ENCRYPTION_KEY`/`CRON_SECRET` already exists — replace the Supabase placeholders):

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**server-only secret**) |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` — encrypts OAuth tokens at rest |
| `CRON_SECRET` | any long random string — protects the cron endpoints |
| `OURA_CLIENT_ID/SECRET` | [Oura developer portal](https://cloud.ouraring.com/oauth/applications) — redirect URI: `<APP_URL>/api/oauth/oura/callback` |
| `GOOGLE_CLIENT_ID/SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — enable the Calendar API, redirect URI: `<APP_URL>/api/oauth/google/callback` |
| `OPENAI_API_KEY` | [OpenAI platform](https://platform.openai.com/api-keys) |

The Oura/Google/OpenAI keys are optional — the app degrades gracefully (cards show
"connect" states) — but you need them for the full experience. Weather uses
[Open-Meteo](https://open-meteo.com), which needs no key.

### 3. Run

```bash
npm install
npm run dev
```

### 4. Deploy (Vercel)

1. Push to GitHub and import into Vercel.
2. Add all env vars (set `NEXT_PUBLIC_APP_URL` to your production URL, and update the
   OAuth redirect URIs at Oura/Google accordingly).
3. `vercel.json` registers two cron jobs automatically:
   - `/api/cron/morning-sync` daily at 05:30 UTC — pulls Oura data, refreshes calendars, generates AI briefings
   - `/api/cron/calendar-sync` hourly — keeps Google Calendar mirrors fresh

   Vercel sends `Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` env var is set.

## Architecture notes

```
src/
  env.ts                  Zod-validated env (server secrets never reach the client)
  proxy.ts                Session refresh + optimistic route protection
  app/
    api/oauth/[provider]/ OAuth start + callback (HMAC state, nonce cookie, CSRF-safe)
    api/cron/             Cron endpoints (bearer-secret protected)
    (app)/                Authenticated app: dashboard, schedule, settings
  actions/                Server Actions (Zod-validated, rate-limited, audited)
  lib/
    supabase/             Browser / server (RLS) / admin (service-role) clients
    integrations/         Oura, Google Calendar, Open-Meteo, OpenAI, token vault
    crypto.ts             AES-256-GCM token encryption + HMAC state signing
    rate-limit.ts         Postgres-backed fixed-window limiter
    audit.ts              Append-only audit log
supabase/migrations/      Schema + RLS policies
```

## Security model

- **RLS everywhere** — every user table has row-level security; users can only read their own
  rows (plus household-shared events through a membership check).
- **Tokens are unreachable from the client** — `oauth_connections` has RLS enabled with *zero*
  policies; only the service role can touch it, and tokens are AES-256-GCM encrypted at rest.
  The client can only see provider + connect date via a security-definer function.
- **Identity is never client-supplied** — every Server Action derives the user from the session
  cookie (`requireUser()`); mutations are scoped by `user_id` *and* re-checked by RLS.
- **OAuth CSRF protection** — HMAC-signed `state` bound to the user id plus an httpOnly nonce
  cookie, verified on callback.
- **Validation & limits** — Zod on every action input, Postgres-backed rate limiting on
  mutations/OAuth/AI calls, length/range checks duplicated as DB constraints.
- **Headers** — CSP, HSTS, X-Frame-Options DENY, nosniff, referrer & permissions policies.
- **Audit log** — append-only record of logins, connections, schedule changes, syncs, and cron
  runs; metadata never contains health values or tokens.
- **Privacy** — health data is never logged. It is sent to OpenAI only to generate your morning
  briefing (disclosed in Settings → Your data).

## License

Private project — all rights reserved.
