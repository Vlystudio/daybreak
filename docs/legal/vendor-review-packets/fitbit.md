# Google LLC (Fitbit) approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | User-requested wearable health import                                                                                      |
| Data categories            | health, fitness, oauth_credentials                                                                                         |
| Health data                | Yes                                                                                                                        |
| Calendar data              | Never                                                                                                                      |
| Direct user prompts        | Not transmitted                                                                                                            |
| Region                     | Provider/API terms review required                                                                                         |
| Retention                  | Local copy until disconnect-with-deletion or account deletion; provider lifecycle external                                 |
| Training/model improvement | External confirmation required                                                                                             |
| Encryption                 | HTTPS; local tokens use AES-256-GCM                                                                                        |
| Subprocessors              | External list review required                                                                                              |
| DPA                        | external_review_required                                                                                                   |
| Breach notice              | Provider terms must be reviewed                                                                                            |
| Deletion                   | Provider revocation then local credential/data deletion                                                                    |
| Security review date       | Missing — release blocker if production provider                                                                           |
| Contract owner             | unassigned                                                                                                                 |
| Emergency disable          | Remove FITBIT client credentials, disable provider registry entry, and preserve encrypted grants for controlled revocation |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
