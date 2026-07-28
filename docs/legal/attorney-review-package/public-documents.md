# Public legal-document review set

The following are the exact release routes and canonical source files. Counsel
should review a rendered production-mode candidate, compare it to source, and
record the Git commit. Dynamic values shown as `LEGAL_*` come only from the
validated identity in `src/lib/legal/identity.ts`; the application will not
produce a production build with missing or placeholder-like values.

| Document                            | Route                            | Canonical source                                 | Version/effective-date source                     | Review focus                                                                                                                |
| ----------------------------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Legal center                        | `/legal`                         | `src/app/legal/page.tsx`                         | Shared identity                                   | Complete links and contact access                                                                                           |
| Terms of Service                    | `/terms`                         | `src/app/terms/page.tsx`                         | `TERMS_VERSION`, `LEGAL_TERMS_EFFECTIVE_DATE`     | Eligibility, wellness scope, AI/third parties, IP, acceptable use, disclaimers, liability, governing law, change acceptance |
| Privacy Policy                      | `/privacy`                       | `src/app/privacy/page.tsx`                       | `PRIVACY_VERSION`, `LEGAL_PRIVACY_EFFECTIVE_DATE` | Sources, purposes, sharing, sensitive-data exclusions, rights, retention, known minors                                      |
| Consumer Health Data Privacy        | `/legal/consumer-health-privacy` | `src/app/legal/consumer-health-privacy/page.tsx` | `LEGAL_HEALTH_PRIVACY_EFFECTIVE_DATE`             | State consumer-health definitions, authorization, sale/share, rights, appeal, processors                                    |
| AI Processing and Output Disclosure | `/legal/ai`                      | `src/app/legal/ai/page.tsx`                      | Privacy version/date                              | Eight granular categories, provider handling, retention/training caveat, output limits                                      |
| Acceptable Use Policy               | `/legal/acceptable-use`          | `src/app/legal/acceptable-use/page.tsx`          | Terms version/date                                | Prohibited conduct, proportional enforcement, non-waivable rights                                                           |
| Health and Medical Disclaimer       | `/legal/health-disclaimer`       | `src/app/legal/health-disclaimer/page.tsx`       | Health privacy date                               | General wellness, no emergency monitoring, measurement/AI limitations, no outcome guarantee                                 |
| Retention and Deletion              | `/legal/retention`               | `src/app/legal/retention/page.tsx`               | Privacy version/date                              | Category periods, durable retry behavior, provider-first/Auth-last, receipts, backups/holds                                 |
| Copyright and IP                    | `/legal/copyright`               | `src/app/legal/copyright/page.tsx`               | Terms date and `LEGAL_COPYRIGHT_OWNER`            | Ownership assertions, user license, OSS/AI assets, notice process, trademarks                                               |
| Security                            | `/security`                      | `src/app/security/page.tsx`                      | Shared security contact                           | Accurate controls, no perfect-security promise, vulnerability contact                                                       |

## Required render review

Use the exact production legal identity and candidate commit. Confirm every
route is reachable without login, works at Dynamic Type/VoiceOver sizes, exposes
the intended effective date, links to every incorporated policy, has a working
mailto structure, and contains no placeholder. Archive a PDF or screenshots in
secure evidence storage; do not commit private addresses or legal advice unless
the owner intends them to be public.

Material Terms/Privacy/AI changes require new versions and the implemented
existing-user gate; counsel must decide which changes require renewed acceptance
or category consent.
