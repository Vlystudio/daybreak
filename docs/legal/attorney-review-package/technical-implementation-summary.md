# Technical implementation summary for counsel

Daybreak V1 is a free, account-based, adults-18-and-older wellness/planning app.
It has no StoreKit purchase, subscription, advertising, tracking, social login,
or medical-device claim. Google, Oura, and Fitbit are optional post-login
connectors. HealthKit is read-only. Nest/social/household and paid surfaces are
source-locked off for the submitted release.

Adult eligibility uses an explicit self-attestation; it is not identity or age
verification. Auth creation is transactionally rejected unless current adult,
Terms, and Privacy metadata is supplied. Pre-existing users receive a pending
gate and are not grandfathered. A self-identified or credibly known minor is
restricted immediately, AI consent is revoked, and durable deletion is queued.

Every public database table has RLS in repository migrations. Protected tables
also have a restrictive current-eligibility policy. OAuth credentials are
AES-256-GCM encrypted and service-only. Enrolled TOTP accounts are forced from
AAL1 to AAL2 at request and server-action boundaries. Password deletion requires
reauthentication and global logout.

AI is off by default and split into basic, tasks, check-in, health, calendar
availability, calendar detail, profile, and uploads. A short-lived purpose-bound
permit authorizes only selected categories. Consent changes increment an epoch,
invalidate permits, purge cache, and prevent stale work. Providers remain
production-disabled until registry approval is complete. Outputs are structured,
sanitized, and constrained against diagnosis, medical certainty, medication
instruction, or emergency-service claims.

Analytics accepts only registered events and primitive allowlisted metadata.
Sensitive health, calendar detail, prompts, images, and check-in text are denied.
Sentry events/breadcrumbs are scrubbed and session replay is not configured.
Notification text is neutral and directs the user into the authenticated app.

Account deletion is durable and provider-first/Auth-last. An opaque receipt
works after Auth deletion for 45 days and contains no raw user ID. Transient or
unconfirmed provider revocation preserves encrypted credentials and Auth for
retry; the app displays blocked rather than falsely completed. Active rows and
addressed Storage objects are removed. Receipt completion and removal of the
briefly retained operational job/raw identifier are atomic, so a worker failure
after Auth deletion remains retryable. Backup expiration follows the approved
provider lifecycle.

Primary evidence: `docs/architecture/`, `supabase/migrations/0049_*` through
`0053_*`, `supabase/tests/`, `config/privacy/`, and the final launch evidence
matrix. Technical controls do not establish legal sufficiency.
