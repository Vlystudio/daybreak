# Vercel Inc. approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Purpose                    | Web hosting, server execution, edge delivery, and deployment logs                                                        |
| Data categories            | requests, operational_metadata, server_processed_user_data                                                               |
| Health data                | May transit server functions; logging is configured to exclude values                                                    |
| Calendar data              | May transit server functions; logging is configured to exclude detail                                                    |
| Direct user prompts        | May be transmitted                                                                                                       |
| Region                     | Project and function region confirmation required                                                                        |
| Retention                  | Deployment, function, firewall, and log retention require confirmation                                                   |
| Training/model improvement | Not applicable to hosting; contract use restrictions require review                                                      |
| Encryption                 | HTTPS in transit; platform controls require review                                                                       |
| Subprocessors              | External list review required                                                                                            |
| DPA                        | external_review_required                                                                                                 |
| Breach notice              | Executed terms/DPA must be reviewed                                                                                      |
| Deletion                   | Deployment/log/account lifecycle must be documented                                                                      |
| Security review date       | Missing — release blocker if production provider                                                                         |
| Contract owner             | unassigned                                                                                                               |
| Emergency disable          | Pause production deployments or remove the production domain, revoke environment secrets, and preserve incident evidence |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
