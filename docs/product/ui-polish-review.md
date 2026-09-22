# Daybreak UI polish review

Candidate: **ui-polish-2026-09-22**, based on source `9a1a7b4`.
Internal rating: **7.2/10**, up from **6.1/10**. See the
[persistent rubric and build history](build-ratings.md).

This candidate implements all ten agreed UI/UX areas together. Local production
compilation and browser verification are complete. It has not been deployed to
production or uploaded to TestFlight; the previously delivered TestFlight build
remains 1.0.0 (28). A new native archive is needed to install the haptics plugin.

## Ten coordinated areas

| Area                                | Implementation                                                                                                                                                          | Evidence and boundary                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Design system                    | Shared color/contrast, typography, spacing, buttons, badges, surfaces and focus styles; corrected dark accent-theme surfaces.                                           | Light/dark Sunrise and dark Ocean inspected; 319/390 px mobile and 1279 px desktop fixture layouts checked. This is not an accessibility certification.                                                                                                                                          |
| 2. Actionable Today                 | Check-in hero, schedule before secondary signals, compact readiness, optional briefing and setup disclosure.                                                            | Empty/synthetic states and the signed-in owner's actual Today inspected. Check-in/health/AI data were not submitted for this review.                                                                                                                                                             |
| 3. Fluid navigation                 | Active mobile indicator, pending feedback, remembered route scroll, Schedule view/date and Health tab/group/range.                                                      | Keyboard Agenda-to-Day works; Day and Health 90-day selection survive navigation; Health scroll restored to 996 px after a route round trip. In-memory view choices are user-scoped.                                                                                                             |
| 4. Consistent motion                | Short fade/slide transitions, spring selection indicators, bounded stagger, restrained chart/ring animation, reduced-motion branches.                                   | Browser interactions inspected and code paths reviewed. No frame-rate or native reduced-motion measurement claimed.                                                                                                                                                                              |
| 5. Feedback and Undo                | Native haptics when available, press feedback, optimistic event completion, rollback/error handling and eight-second Undo.                                              | Actual completion and Undo confirmed by success feedback, then reload confirmed the original incomplete state. An early check raced the refresh; the completed round trip passed. Old shells without Haptics skip the enhancement.                                                               |
| 6. Schedule and editor              | Agenda starts today, optional AI tools collapsed, accessible view tabs, mobile sheet, optional fields, overlap guidance, all-day date handling and delete confirmation. | Synthetic title validation, all-day switching, conflict warning and Cancel verified. Existing owner event dates inspected and canceled. Nine date/overlap tests cover boundaries, local dates and legacy imports. Create/update/delete database round trips were not exercised on owner records. |
| 7. Health                           | 7/30/90-day filters, latest-reading context, chart units, unique gradients, personal baselines and accessible exact-value tables.                                       | Real sparse seven-day and broader 90-day data verified, plus 30-day default; latest dates remain explicit. No synchronization or AI analysis triggered. Heading avoids describing stale readings as today's measurements.                                                                        |
| 8. Optional onboarding              | Three short steps with Back/Continue, saved in-form choices, skip to Today and optional integrations.                                                                   | Synthetic first-run steps 1–3 inspected; no final preference save or new account created. Existing users keep a complete preferences form.                                                                                                                                                       |
| 9. States and recovery              | Matching loading skeletons, actionable empty states, network banner, persistent form errors and retained input on request failure.                                      | Empty/loaded states and invalid-login feedback inspected; exception paths reviewed. Actual offline/reconnect transitions and server-rejected writes still need device QA.                                                                                                                        |
| 10. Accessibility and device layout | Skip link, keyboard tabs, larger core tap targets, labels/error associations, responsive sheets, safe-area spacing, reduced-motion styles and chart tables.             | No horizontal document overflow at inspected widths; Health tabs remain one line with approximately 44 px height at 319 px. Native keyboard, Dynamic Type, VoiceOver and home-indicator behavior remain physical-device checks.                                                                  |

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:run -- --maxWorkers=2`: **50 files, 348 tests passed**.
- `npm run build`: passed with Next.js **16.3.6**, including TypeScript and all generated routes.
- `npm run start -- --port 3001 --hostname 127.0.0.1`: optimized production preview
  served the authenticated Today, Schedule and Health screens successfully.
- `npm audit --audit-level=low`: **0 vulnerabilities** reported at review time.
- `npm run verify:app-store-sections-1-8 -- --allow-external-blockers --no-write-evidence`:
  **23 pass, 0 fail, 12 external/manual blockers, 1 not applicable**.
- Regenerated dependency/license artifacts after dependency updates; compliance generation is current.
- Reviewed React hook usage, state ownership, lazy native loading, keyboard semantics and reduced-motion branches.

The first fully parallel test run hit a five-second cold-import timeout in the
existing Coach route test; the complete suite passed with two workers. No test
expectation or timeout was weakened. Removing the temporary review route left a
stale generated Next development validator; removing that single generated file
and regenerating route types resolved the typecheck. The temporary route is absent
from the production build. Browser logs included an injected `ag-scripts.js`
fetch error; no app component exception was observed in that inspected log sample.

## Release dependencies and handling of private data

Updated Next and compatible dependency resolutions to address advisories found
during verification, including [the Windows Server Function advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36)
and [the image-processing advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).
The current dependency audit is clean. Next's development Server Function argument
logging is explicitly disabled because authentication actions carry credentials.
Local backend connectivity uses Node's system CA support; certificate validation
and authentication remain enforced.

Screenshots and synthetic fixture source stay in ignored `build/ui-polish/`.
Owner screenshots contain private account data: do not commit or publicly upload
them. No user credentials or environment files are included in this change.

Before captures: `before/01-today.png`, `02-schedule.png`, `03-editor.png`,
`04-health.png`. After captures include synthetic states `after/01` through `07`
and signed-in captures `08-real-today.png`, `09-real-editor.png`,
`10-real-health-small.png`, `11-real-today-phone.png`,
`12-real-schedule-phone.png`. The images were inspected during this run.
Some early screenshots use a 585 CSS-pixel viewport because Windows/browser
scaling differs from the requested dimensions; DOM measurements confirmed the
later 319 and 390 CSS-pixel checks. Treat these as flow/layout evidence, not
pixel-matched before/after comparisons or physical-device screenshots. The Health
capture predates the final heading wording change.

## What still prevents an App Store-ready claim

The repository gate still lacks current evidence for legal identity, processor and
AI provider approvals, attorney review, license review, asset ownership, production
migration reconciliation, representative staging deletion, auth-provider settings,
signed archive, aggregate privacy report and physical-iPhone testing. That command
checks repository evidence and its process environment; it did not inspect Vercel's
live environment, so its identity warning does not establish that previously
configured production values are missing. This UI task does not substitute for
those approvals or evidence records.

Before release, use the existing physical-device matrix with the exact next signed
build. Pay particular attention to keyboard opening in the bottom sheet, home
indicator clearance, font enlargement, VoiceOver reading/focus order, reduced
motion, completion/Undo under a poor connection, offline form recovery and native
haptics. Public-release status remains separate from the subjective UI rating.
