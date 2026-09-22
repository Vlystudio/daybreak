# Operator-controlled GroceryTracker project approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| Purpose                    | Grocery deal feed                                                             |
| Data categories            | postal_code, product_query                                                    |
| Health data                | Never                                                                         |
| Calendar data              | Never                                                                         |
| Direct user prompts        | Not transmitted                                                               |
| Region                     | Owner project configuration required                                          |
| Retention                  | Feed policy confirmation required                                             |
| Training/model improvement | None expected; owner confirmation required                                    |
| Encryption                 | HTTPS                                                                         |
| Subprocessors              | Depends on the operator-controlled project                                    |
| DPA                        | owner_review_required                                                         |
| Breach notice              | Owner incident procedure required                                             |
| Deletion                   | No Daybreak account identifier supplied                                       |
| Security review date       | Missing — release blocker if production provider                              |
| Contract owner             | unassigned                                                                    |
| Emergency disable          | Remove GROCERYTRACKER_URL and anon key and redeploy with deal import disabled |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
