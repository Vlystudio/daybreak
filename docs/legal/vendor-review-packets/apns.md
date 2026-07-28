# Apple Push Notification service approval packet

Production status: **proposed_disabled**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Purpose                    | Proposed native notification delivery                                                                  |
| Data categories            | device_token, neutral_notification                                                                     |
| Health data                | Prohibited                                                                                             |
| Calendar data              | Prohibited                                                                                             |
| Direct user prompts        | Not transmitted                                                                                        |
| Region                     | Apple platform terms                                                                                   |
| Retention                  | Token lifetime and Apple platform behavior                                                             |
| Training/model improvement | Not applicable; confirm Apple terms                                                                    |
| Encryption                 | TLS and Apple platform transport                                                                       |
| Subprocessors              | Apple infrastructure                                                                                   |
| DPA                        | platform_terms_review_required                                                                         |
| Breach notice              | Apple platform terms                                                                                   |
| Deletion                   | Token removal on disable/account deletion                                                              |
| Security review date       | Missing — release blocker if production provider                                                       |
| Contract owner             | unassigned                                                                                             |
| Emergency disable          | Revoke APNs key/certificate and disable native notification sender; no APNs sender is configured in V1 |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
