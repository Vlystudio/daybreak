# Open-Meteo approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                          |
| -------------------------- | ------------------------------------------------------- |
| Purpose                    | Fallback local weather for planning                     |
| Data categories            | coarse_location_query                                   |
| Health data                | Never                                                   |
| Calendar data              | Never                                                   |
| Direct user prompts        | Not transmitted                                         |
| Region                     | External confirmation required                          |
| Retention                  | External confirmation required                          |
| Training/model improvement | External confirmation required                          |
| Encryption                 | HTTPS                                                   |
| Subprocessors              | External review required                                |
| DPA                        | external_review_required                                |
| Breach notice              | Provider terms must be reviewed                         |
| Deletion                   | No Daybreak account identifier supplied                 |
| Security review date       | Missing — release blocker if production provider        |
| Contract owner             | unassigned                                              |
| Emergency disable          | Disable fallback calls and redeploy no-weather behavior |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
