# Daybreak internal build ratings

Requested by the owner on September 22, 2026. Include a rating with every build
handoff, whether it is a local candidate, web deployment or TestFlight binary.
These are editorial assessments of market readiness, not App Store ratings or
predictions of retention or revenue. Scores can go down when evidence warrants it.

## Consistent rubric

| Dimension                            | Weight | Evidence                                                             |
| ------------------------------------ | ------ | -------------------------------------------------------------------- |
| Visual craft and consistency         | 20%    | Mobile/desktop, light/dark, typography and hierarchy                 |
| Core task clarity and ease           | 25%    | Today, create/edit/complete events, Health, setup                    |
| Responsiveness and motion            | 15%    | Navigation, feedback, loading, interrupted interactions              |
| Accessibility and resilience         | 20%    | Keyboard, reduced motion, contrast, errors, offline, small screens   |
| Product value and release confidence | 20%    | Differentiation, automated checks, device evidence, release blockers |

1–3: broken or confusing. 4–5: functional but visibly unfinished. 6: credible beta.
7: polished early release with specific gaps. 8: competitive, consistently finished
experience supported by device evidence. 9: exceptional execution and meaningful
user validation. 10: rare benchmark quality, supported by independent evidence.

Use weighted scores, rounded to one decimal. Include confidence and untested areas.
A browser-only review cannot establish native performance, haptics, VoiceOver or
market demand. Public legal/privacy gates remain independent of visual polish.

## September 22 polish baseline — source 9a1a7b4 / live TestFlight 28

Provisional rating: **6.1/10** (visual 6, tasks 6, responsiveness 6, accessibility
and resilience 6, value/release confidence 6.5). Confidence: moderate for visible
mobile UX, low for device performance and commercial outcomes.

Current-run mobile captures: `build/ui-polish/before/01-today.png`,
`02-schedule.png`, `03-editor.png`, `04-health.png`. These local-only captures
contain owner data and must not be committed or uploaded to public artifacts.

1. Today: coherent warm identity; oversized secondary cards push useful actions
   below the initial viewport. Briefing settings compete with the main next step.
2. Schedule: readable events, but optional AI setup dominates the screen and the
   initial agenda opens on yesterday. Tabs lack full keyboard behavior in code.
3. Event editor: labels exist, but the mobile editor is a long centered modal with
   optional fields always exposed; no visible conflict warning or delete confirmation.
4. Health: sensible sections and source confidence; uneven density, muted badges,
   insufficient range controls and data freshness context on charts.

Code inspection also found shared tab animation IDs, inconsistent animation timing,
an oversized ring animation without its own reduced-motion check, and loading
placeholders that do not match the reduced launch dashboard. Screenshots alone do
not establish accessibility compliance. Native iPhone verification remains pending.

## September 22 candidate — ui-polish-2026-09-22

**7.2/10**, compared with the 6.1 baseline. This is the local production-build
candidate documented in [the implementation review](ui-polish-review.md), based on
9a1a7b4. It is not a new live deployment or TestFlight binary.

| Dimension                            | Score | Reason                                                                                                                                               |
| ------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual craft and consistency         | 7.6   | Shared surfaces, readable themes, coherent controls and a quieter hierarchy.                                                                         |
| Core task clarity and ease           | 7.6   | Today prioritizes action; agenda starts today; the editor and optional setup are shorter.                                                            |
| Responsiveness and motion            | 7.2   | Short transitions, retained view/scroll state, optimistic completion and verified Undo. No device frame-time measurement yet.                        |
| Accessibility and resilience         | 7.0   | Larger targets, keyboard tabs, exact chart tables, reduced-motion support and persistent errors. Physical VoiceOver and offline testing remain open. |
| Product value and release confidence | 6.5   | The core proposition is clearer and repository checks pass; differentiation, user validation and public-release evidence still need work.            |

Weighted total: **7.2**. Confidence is moderate for browser usability and visual
consistency, low for native performance and commercial outcomes. The largest gain
is fewer decisions between opening the app and acting on the day. The biggest
remaining weaknesses are a still-long Today page, dependence on fresh wearable
data, and limited evidence that new users immediately understand the value.

Contemporary reference points checked on September 22: [Apple's motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion)
and [Things' product experience](https://culturedcode.com/things/features/). These
inform the quality bar for restrained motion, clarity and attention to interaction
details; they are not a comparative usability study. This rating is our editorial
judgment, not a predicted App Store score, ranking, retention rate or revenue.

For an 8: verify the signed candidate on iPhone (including reduced motion,
VoiceOver, keyboard/safe areas, interrupted saves and haptics), resolve the release
evidence gaps, and observe several first-time users completing the core journey.

## September 22 public address removal — source 081d2a7

Live web release: **6.1/10**, using the unchanged baseline dimension scores above.
The focused privacy fix removes the owner's postal address and preserves Settings
without that configuration. It also retains the tested dependency security fixes.
Verification includes 341 tests, lint, compliance checks, a production build and
live browser checks of Terms, Privacy and signed-in Settings. See the
[release record](../operations/public-address-removal-2026-09-22.md).

The improvement is privacy and configuration resilience; the baseline's visual
and task-flow weaknesses remain. Confidence is moderate for browser behavior and
low for native performance and market outcomes. UI polish remains local at
**7.2/10**; TestFlight remains build 28. No physical-device testing was performed
for this web update.

## September 22 — TestFlight 29 and polished live web release

**7.2/10**, retaining the dimension scores of the UI candidate above. Native build
29 is from `23d246f`; the live web runtime is `e1db3e4`, deployment
`dpl_AksUGuBGxJopXQ45sBUzwQxqURBu`. This release now delivers the polish and removes
controls for unavailable integrations across the core screens. Profile edits no
longer depend on geocoding an unchanged city.

Verification: 352 tests, TypeScript, lint, compliance freshness, GitHub CI/Security/
CodeQL, a successful Vercel production build, signed-in live Today/Schedule/Health/
Settings checks, and a successful App Store-eligible archive. The owner reports
the supplied physical-device checklist passed on iPhone 16 Pro Max / iOS 27
developer beta; see the [device report](../launch-readiness/evidence/05-health-and-healthkit/owner-build-29-device-report.md).

Confidence in basic native operation improves, but this does not justify a higher
market score by itself. Stable-iOS coverage, first-time-user validation, complete
deletion/recovery evidence and store readiness remain open. The strongest gain is
a cohesive core without dead-end integration prompts. Product differentiation and
the long Today screen remain weaknesses. This is an editorial readiness rating,
not a predicted App Store rating or commercial outcome.
