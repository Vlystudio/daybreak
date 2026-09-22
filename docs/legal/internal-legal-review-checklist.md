# Internal legal implementation-evidence checklist

Qualified counsel must review public text. This mapping helps verify factual promises; it is not legal advice.

| Policy statement                               | Implementation evidence                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Adults 18+ only                                | `src/actions/auth.ts`, `account_eligibility`, signup trigger, adult pgTAP        |
| No automatic adult grandfathering              | migration `0049`, eligibility middleware/action tests                            |
| No health advertising/tracking                 | analytics allowlist, Sentry scrubber, neutral notification tests, data inventory |
| Optional granular AI sharing                   | migration `0051`, opaque permits, provider registry, consent matrix tests        |
| Calendar detail separate                       | planner/sync redaction and consent tests                                         |
| Provider revocation before credential deletion | deletion worker and token revocation tests                                       |
| Export excludes credentials                    | portable export allowlist/redaction tests                                        |
| Account deletion is durable and status-visible | migration `0050`, worker/cron/status page, deletion tests                        |
| Rights request and appeal                      | migration `0052`, Settings UI, pgTAP                                             |
| Retention periods                              | structured retention schedule and dry-run/write pgTAP                            |
| No absolute security promise                   | public policy/Terms/security pages and placeholder verifier                      |
| Wellness, not medical care                     | health disclaimer, UI copy, AI safety boundary                                   |
| No emergency response                          | health disclaimer and emergency output boundary tests                            |

Counsel evidence must identify exact document versions, operator identity, jurisdiction, liability/dispute decisions, launch regions, and approval date. A policy change that broadens processing requires a new version and any legally required reacceptance or consent.
