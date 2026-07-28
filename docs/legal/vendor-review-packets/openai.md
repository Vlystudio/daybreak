# OpenAI, L.L.C. approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Optional user-requested briefings, planning, coaching, and fallback image analysis                                    |
| Data categories            | direct_prompt, tasks, checkins, health, calendar_availability, calendar_detail, profile, uploads                      |
| Health data                | Only with current basic and health-category AI consent                                                                |
| Calendar data              | Availability or detail only under the separately selected category                                                    |
| Direct user prompts        | May be transmitted                                                                                                    |
| Region                     | External project and contract confirmation required                                                                   |
| Retention                  | Verify the approved API project data-control setting; abuse-monitoring retention may apply                            |
| Training/model improvement | API business data is not used for training by default; owner must not opt in                                          |
| Encryption                 | HTTPS in transit; provider controls at rest require review                                                            |
| Subprocessors              | External list review required                                                                                         |
| DPA                        | external_review_required                                                                                              |
| Breach notice              | Executed terms/DPA must be reviewed                                                                                   |
| Deletion                   | No raw provider response log retained by Daybreak; provider lifecycle requires confirmation                           |
| Security review date       | Missing — release blocker if production provider                                                                      |
| Contract owner             | unassigned                                                                                                            |
| Emergency disable          | Remove OPENAI_API_KEY and mark openai disabled in the approved provider registry; redeploy and verify AI fails closed |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
