# Retention and account deletion

The structured source is `config/privacy/retention-schedule.json`; the generated
review table is `docs/legal/retention-schedule.md`. Counsel should reconcile it
against provider backup/log settings and contractual deletion terms.

Deletion after password reauthentication immediately changes eligibility to
`deletion_pending`, increments the consent epoch, globally signs out, and queues
a durable job. The worker atomically claims work, creates a capability-protected
receipt, revokes Google/Oura/Fitbit grants, removes Storage and local integration,
notification, social, retained-reference, cache, and user-owned records, then
deletes Supabase Auth last. Network, 429, 5xx, and unconfirmed provider rejections
retry with bounded backoff; after repeated failure the receipt shows blocked and
Auth/credentials remain for controlled resolution. It never promises immediate
backup erasure.

The receipt survives Auth deletion, stores only token/subject hashes and step
summary, and expires after 45 days. A service-only transaction atomically marks
that receipt complete and removes the briefly retained operational job/raw user
ID, so an interrupted finalization remains retryable. Backups are isolated and expire under the
provider lifecycle; they are not selectively returned to active use except for
approved recovery, security, or legal needs. Any hold must be authorized,
narrowly scoped, and prohibited from ordinary product use.

Counsel decisions: statutory deletion exceptions; backup/log periods; required
consumer notices; authentication for rights requests; receipt/rights-workflow
retention; processor propagation; appeal deadlines; and the operator process for
blocked provider revocation.
