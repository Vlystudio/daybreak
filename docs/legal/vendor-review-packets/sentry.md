# Functional Software, Inc. (Sentry) approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Purpose                    | Redacted crash and performance diagnostics                                                           |
| Data categories            | redacted_diagnostics, release, device_metadata                                                       |
| Health data                | Prohibited by before-send and breadcrumb scrubbers                                                   |
| Calendar data              | Prohibited                                                                                           |
| Direct user prompts        | Not transmitted                                                                                      |
| Region                     | Project configuration confirmation required                                                          |
| Retention                  | Project setting confirmation required                                                                |
| Training/model improvement | External confirmation required                                                                       |
| Encryption                 | HTTPS in transit; provider controls require review                                                   |
| Subprocessors              | External list review required                                                                        |
| DPA                        | external_review_required                                                                             |
| Breach notice              | Executed terms/DPA must be reviewed                                                                  |
| Deletion                   | Project event and account deletion controls require review                                           |
| Security review date       | Missing — release blocker if production provider                                                     |
| Contract owner             | unassigned                                                                                           |
| Emergency disable          | Remove NEXT_PUBLIC_SENTRY_DSN and Sentry auth settings, redeploy, and verify the SDK sends no events |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
