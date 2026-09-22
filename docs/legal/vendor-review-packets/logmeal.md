# LogMeal approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Optional user-initiated meal image analysis                                                                                               |
| Data categories            | meal_image, direct_feature_input                                                                                                          |
| Health data                | No health record context; an image may itself reveal sensitive information                                                                |
| Calendar data              | Never                                                                                                                                     |
| Direct user prompts        | Not transmitted                                                                                                                           |
| Region                     | External confirmation required                                                                                                            |
| Retention                  | External confirmation required                                                                                                            |
| Training/model improvement | External confirmation required                                                                                                            |
| Encryption                 | HTTPS in transit; provider controls at rest require review                                                                                |
| Subprocessors              | External list review required                                                                                                             |
| DPA                        | external_review_required                                                                                                                  |
| Breach notice              | Executed terms/DPA must be reviewed                                                                                                       |
| Deletion                   | Transient Daybreak processing; provider deletion behavior requires confirmation                                                           |
| Security review date       | Missing — release blocker if production provider                                                                                          |
| Contract owner             | unassigned                                                                                                                                |
| Emergency disable          | Remove LOGMEAL_API_KEY and provider approval; redeploy so food vision uses only an independently approved fallback or remains unavailable |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
