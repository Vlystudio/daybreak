# Known-minor account response

Daybreak does not scan content to infer age and has no parental-consent or child-account path. This procedure applies only when support receives credible actual knowledge.

1. Do not request a birthdate, ID, medical detail, or parental profile unless counsel authorizes a narrowly necessary step.
2. Record only a case reference, evidence category, decision maker, and decision date in the protected support system. Do not copy the minor&apos;s content into tickets.
3. Use the authenticated admin workflow to mark the account for `known_minor` deletion. The eligibility state blocks app/RLS access and increments the consent epoch immediately.
4. The restricted eligibility state stops notifications, calendar sync, health ingest, AI authorization, and user RLS access. Keep encrypted OAuth credentials service-only until the durable deletion worker remotely revokes providers; only then may it remove local credentials and delete Auth to revoke sessions.
5. Verify the receipt is completed or escalate a blocked provider step. Do not convert the account to parental consent.
6. Preserve only evidence counsel specifically requires, separated from product data and subject to a hold/expiry.
7. Complete any legally required human-reviewed notification. Software must not send breach/legal notices automatically.

Operator access requires the dedicated `ADMIN_ACTION_SECRET` (at least 32 random characters), never `CRON_SECRET`; requests and logs must never include raw health values or the reason narrative. Evidence: deletion receipt reason `known_minor`, sanitized job status, support case reference outside the product database.
