# Authentication hardening

Daybreak uses Supabase Auth email/password accounts. Password hashes, refresh
tokens, recovery-token replay protection, and token rotation are provider
responsibilities; Daybreak never receives or stores a password hash.

Repository controls:

- Signup, login, resend, and password recovery use server actions with
  IP/email-derived hashed rate-limit keys and enumeration-resistant responses.
- New passwords must contain at least 12 characters. Login accepts legacy
  provider-managed passwords so a policy increase does not lock out an existing
  account; the production Supabase minimum must be set to the same or stronger.
- Normal app pages and every `requireUser()` Server Action enforce current adult
  eligibility and, for accounts with a verified TOTP factor, AAL2.
- `/login/mfa` performs a TOTP challenge and accepts only same-origin relative
  return paths. It provides a sign-out escape if a factor is unavailable.
- Settings supports TOTP enrollment/removal, current-device sign-out, and global
  refresh-token revocation. Sensitive account deletion separately reauthenticates
  with the current password and globally revokes sessions before durable cleanup.
- OAuth connectors bind `state` and `nonce` to HTTP-only cookies, enforce a fixed
  application callback, use minimum connector scopes, and validate the provider
  in trusted server code. They connect Calendar/wearables after primary login;
  they do not establish a Daybreak account.
- The iOS shell does not write a Daybreak refresh/access token to
  `@capacitor/preferences` or `UserDefaults`. Authentication stays in secure,
  HTTP-only WKWebView cookies; native preferences contain only connection and
  last-sync state. A custom native Keychain token store is therefore not
  applicable to V1.

Supabase does not expose a supported end-user API in this architecture for
enumerating every refresh-token device/session. Daybreak provides global
revocation instead of inventing a partial device list.

## Production evidence still required

Create
`docs/launch-readiness/evidence/04-auth-and-accounts/auth-provider-configuration.json`
with reviewer, project reference (not a secret), date, and screenshots or secure
evidence references proving:

- email confirmation and secure email change are enabled;
- password minimum is at least 12 and leaked-password protection is enabled;
- refresh-token rotation/reuse interval and JWT expiry meet the approved policy;
- Supabase auth rate limits and CAPTCHA/WAF controls are configured;
- recovery and confirmation links are single-use and expire as expected;
- global sign-out revokes other test sessions;
- AAL1 is challenged and AAL2 succeeds for an enrolled staging account.

Missing dashboard/device evidence is a release blocker, not a repository pass.
