# Supabase Auth production configuration review

Repository controls are automated, but Supabase dashboard policy and staged
session behavior require an authorized project reviewer. Do not put API keys,
database passwords, JWTs, recovery links, email addresses, or raw project refs in
the evidence JSON.

## Dashboard inspection

In Supabase Dashboard, select the confirmed production project and record only
the sanitized values in a copy of
`config/auth/supabase-auth-evidence.template.json`:

1. Authentication > Providers > Email: confirmation required, secure email
   changes, signup availability, and recovery enabled.
2. Authentication > Security: minimum password length at least 12 and leaked
   password protection enabled.
3. Authentication > Sessions: JWT expiry, inactivity timeout, maximum lifetime,
   refresh-token rotation, reuse detection, and reuse interval.
4. Authentication > Rate Limits: signup, token, and recovery limits. Confirm
   CAPTCHA or the approved Vercel edge/WAF abuse control.
5. Authentication > URL Configuration: production HTTPS Site URL and the exact
   `/auth/callback` redirect; remove wildcards, preview URLs, localhost, and stale
   domains from production.
6. Authentication > Providers: account-login providers must be empty for V1.
   Google, Oura, and Fitbit are app connectors, not Supabase login providers.
7. Authentication > MFA: TOTP enabled. In staging, prove AAL1 is challenged and
   AAL2 succeeds for an enrolled account.
8. Confirm Sign in with Apple remains not applicable while email/password is the
   only account login. Reassess before enabling any social login.
9. In isolated staging, prove a missing adult/legal trigger payload rolls back
   Auth creation, a valid payload creates eligibility/acceptances, global logout
   revokes a second session, recovery links are single-use/expired as configured,
   and account deletion removes Auth.

Reference screenshots or secure evidence locations without committing private
dashboard data. Set a review date and named owner.

## Validate supplied settings

```powershell
node scripts/verify-supabase-auth-config.mjs `
  --input C:\secure\production-auth.sanitized.json `
  --evidence docs/launch-readiness/evidence/04-auth-and-accounts/auth-provider-configuration.json
```

The verifier rejects secret-bearing fields, validates every checklist item and
repository-controlled counterpart, and reports `blocked` until all dashboard and
staging values are supplied. An output file alone is not a pass; launch
verification reads its `status`.
