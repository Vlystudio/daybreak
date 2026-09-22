# Google LLC approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | User-requested calendar availability and optional detail sync                                                                |
| Data categories            | calendar_availability, calendar_detail, oauth_credentials                                                                    |
| Health data                | Never sent to Google Calendar                                                                                                |
| Calendar data              | Yes; detail is separately controlled for AI downstream use                                                                   |
| Direct user prompts        | Not transmitted                                                                                                              |
| Region                     | Provider/API terms review required                                                                                           |
| Retention                  | Local mirror and credential until disconnect/account deletion                                                                |
| Training/model improvement | External confirmation required                                                                                               |
| Encryption                 | HTTPS; local tokens use AES-256-GCM                                                                                          |
| Subprocessors              | External list review required                                                                                                |
| DPA                        | external_review_required                                                                                                     |
| Breach notice              | Provider terms must be reviewed                                                                                              |
| Deletion                   | Provider revocation and local mirror/credential deletion                                                                     |
| Security review date       | Missing — release blocker if production provider                                                                             |
| Contract owner             | unassigned                                                                                                                   |
| Emergency disable          | Remove GOOGLE client credentials, disable connector, preserve encrypted grants for controlled revocation, and stop sync cron |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
