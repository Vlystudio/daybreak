# Privacy and consumer-health rights runbook

Users submit predefined, authenticated requests in Settings. The database derives the subject from `auth.uid()`, denies cross-user access, records an event, and sets a 30-day target shown to the user.

1. Verify the session/account; request proportionate additional verification only when necessary.
2. Classify confirmation, access, correction, deletion, withdrawal, cease-collection, cease-sharing, third-party-list, or appeal.
3. Review jurisdiction and change the internal deadline only under an approved rule; never extend silently.
4. Assemble data through the portable export and processor inventory. Exclude credentials, permits, abuse rules, and other users.
5. For correction, update editable source data or annotate immutable legal/consent history rather than rewriting evidence.
6. For withdrawal/cessation, revoke AI categories and disconnect/delete affected integrations as requested.
7. Propagate applicable actions to processors and record only status/category, not health content.
8. Update status using the service-only RPC. Denials need an approved outcome code and appeal instructions.
9. Appeals receive human review by a different authorized reviewer where required.
10. Export sanitized operational evidence; do not include raw health data in tickets or email.

No retaliation is permitted. Account deletion uses the dedicated immediate deletion flow; a formal deletion-right request does not falsely claim deletion before the durable job completes.
