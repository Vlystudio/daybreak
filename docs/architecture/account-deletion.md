# Account deletion design

`queue_account_deletion_job` atomically marks the account `deletion_pending`, increments consent epoch, and creates/reuses a durable job. The browser receives a random status capability; only its SHA-256 hash is stored. Global sign-out is attempted immediately.

The worker atomically claims a job and records retry state. It revokes Google, Oura, and Fitbit credentials at official endpoints before deleting encrypted local credentials. Transient network, 429, and 5xx failures retry with backoff; terminal provider responses are recorded by category. It then removes storage, notifications, analytics, AI/cache state, social references, and user roots before deleting the Supabase Auth user. Auth deletion invalidates remaining sessions.

Before Auth deletion, the worker writes a receipt containing a hashed subject, reason, status, and non-sensitive step summary—never a raw user ID. The operational job briefly survives Auth deletion so an interrupted finalization remains retryable. A service-role-only database function atomically completes the receipt and removes that job/raw ID; a retry treats an explicit Auth `user_not_found` response as success. The public status page requires the HttpOnly capability cookie, works after Auth deletion, and receipts expire after 45 days. A blocked job is surfaced honestly.

Tests cover queue authorization, atomic claims, retry/terminal provider behavior, storage/table orchestration mocks, Auth-last ordering, and receipt survival. A synthetic staging account with every relational/storage/provider state remains required for final operator evidence.
