# Resend, Inc. approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Purpose                    | Transactional account and neutral notification email                                                       |
| Data categories            | email_address, neutral_notification                                                                        |
| Health data                | Prohibited                                                                                                 |
| Calendar data              | Prohibited                                                                                                 |
| Direct user prompts        | Not transmitted                                                                                            |
| Region                     | External confirmation required                                                                             |
| Retention                  | Message and log retention requires confirmation                                                            |
| Training/model improvement | External confirmation required                                                                             |
| Encryption                 | TLS in transit; provider controls require review                                                           |
| Subprocessors              | External list review required                                                                              |
| DPA                        | external_review_required                                                                                   |
| Breach notice              | Executed terms/DPA must be reviewed                                                                        |
| Deletion                   | Provider log/contact deletion support requires confirmation                                                |
| Security review date       | Missing — release blocker if production provider                                                           |
| Contract owner             | unassigned                                                                                                 |
| Emergency disable          | Remove RESEND_API_KEY and redeploy; account recovery/confirmation impact requires an owner incident banner |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
