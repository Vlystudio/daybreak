# Supabase Storage approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Purpose                    | Avatar and addressed user-file storage                                                       |
| Data categories            | avatar, user_upload                                                                          |
| Health data                | No health file is intentionally stored in V1                                                 |
| Calendar data              | Never                                                                                        |
| Direct user prompts        | Not transmitted                                                                              |
| Region                     | Same as approved Supabase project                                                            |
| Retention                  | Avatar until replaced/deleted; all addressed objects on account deletion                     |
| Training/model improvement | None; infrastructure contract review required                                                |
| Encryption                 | HTTPS and Supabase storage controls                                                          |
| Subprocessors              | Inherits Supabase list                                                                       |
| DPA                        | inherits_supabase_review                                                                     |
| Breach notice              | Inherits Supabase terms/DPA                                                                  |
| Deletion                   | Recursive prefix and conventional-root deletion before Auth removal                          |
| Security review date       | Missing — release blocker if production provider                                             |
| Contract owner             | unassigned                                                                                   |
| Emergency disable          | Disable upload server action and bucket access; preserve evidence before any bucket deletion |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
