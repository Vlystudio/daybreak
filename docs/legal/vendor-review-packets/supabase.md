# Supabase, Inc. approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Authentication, PostgreSQL database, object storage, and server-side platform services                                                |
| Data categories            | account, user_content, health, calendar, oauth_ciphertext, push_endpoint, rights_requests                                             |
| Health data                | Yes, as the primary application data store                                                                                            |
| Calendar data              | Yes, for user-requested calendar sync                                                                                                 |
| Direct user prompts        | May be transmitted                                                                                                                    |
| Region                     | Production project region confirmation required                                                                                       |
| Retention                  | Active data and backup/PITR lifecycle must be confirmed                                                                               |
| Training/model improvement | Not applicable to hosted infrastructure; contract use restrictions require review                                                     |
| Encryption                 | TLS in transit; provider and project encryption controls require evidence                                                             |
| Subprocessors              | External list review required                                                                                                         |
| DPA                        | external_review_required                                                                                                              |
| Breach notice              | Executed terms/DPA must be reviewed                                                                                                   |
| Deletion                   | Row cascades, Storage cleanup, Auth deletion, and backup expiry                                                                       |
| Security review date       | Missing — release blocker if production provider                                                                                      |
| Contract owner             | unassigned                                                                                                                            |
| Emergency disable          | Disable application deployments and rotate/revoke project keys; do not delete the project without an approved recovery and legal plan |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
