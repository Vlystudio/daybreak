# Browser push services approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| Purpose                    | User-requested neutral web notifications                               |
| Data categories            | push_endpoint, device_key, neutral_notification                        |
| Health data                | Prohibited                                                             |
| Calendar data              | Prohibited                                                             |
| Direct user prompts        | Not transmitted                                                        |
| Region                     | Browser/platform dependent                                             |
| Retention                  | Subscription lifetime; dead endpoints are pruned                       |
| Training/model improvement | Platform terms review required                                         |
| Encryption                 | Web Push payload encryption and HTTPS                                  |
| Subprocessors              | Browser vendor services                                                |
| DPA                        | not_applicable_or_review_required                                      |
| Breach notice              | Platform terms                                                         |
| Deletion                   | Unsubscribe, token pruning, and account deletion                       |
| Security review date       | Missing — release blocker if production provider                       |
| Contract owner             | unassigned                                                             |
| Emergency disable          | Remove VAPID keys/public key and redeploy; stop notification cron jobs |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
