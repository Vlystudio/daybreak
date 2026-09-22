# Daybreak on Supabase approval packet

Production status: **external_review_required**. This packet is preparation only; no contract or security approval is implied.

| Field                      | Recorded value                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Purpose                    | Allowlisted first-party product events without sensitive values                                        |
| Data categories            | allowlisted_product_interaction                                                                        |
| Health data                | Prohibited                                                                                             |
| Calendar data              | Prohibited                                                                                             |
| Direct user prompts        | Not transmitted                                                                                        |
| Region                     | Same as approved Supabase project                                                                      |
| Retention                  | 365 days through the retention worker                                                                  |
| Training/model improvement | None                                                                                                   |
| Encryption                 | Supabase transport/storage controls                                                                    |
| Subprocessors              | Supabase/Vercel only                                                                                   |
| DPA                        | inherits_supabase_review                                                                               |
| Breach notice              | Inherits applicable platform terms and owner incident plan                                             |
| Deletion                   | Deleted on account deletion; aged by retention worker                                                  |
| Security review date       | Missing — release blocker if production provider                                                       |
| Contract owner             | unassigned                                                                                             |
| Emergency disable          | Disable analytics writes in application configuration and deploy; retain the strict metadata allowlist |

## Owner decision

- [ ] Confirm exact legal entity and service/product tier.
- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.
- [ ] Execute required contract/DPA and record its secure reference.
- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.
- [ ] Approve the exact production data categories, or keep the integration disabled.
