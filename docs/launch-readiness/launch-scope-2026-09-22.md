# Focused V1 launch scope

Implemented and deployed to https://daybreak-one.vercel.app on September 22, 2026. This is engineering verification of the working tree, not approval to submit an iOS build. See the [production release record](../operations/production-release-2026-09-22.md).

## Release experience

The primary sections are **Today, Schedule and Health**. Settings and Plan preferences remain available from More.

| Deferred feature | Release behavior                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grocery          | Meal planning, shopping lists, pantry, receipts, price comparisons and deal notifications are unavailable. Deal imports stop.                                            |
| Coach            | Structured workouts, exercise library, equipment, fitness programs and trainer nutrition programs are unavailable. Daily planning no longer creates structured workouts. |
| Nutrition        | Food/photo logging, calorie and macro tracking, water logging and body-goal entry are unavailable. Food reminders and the web photo share target are disabled.           |

The flags in `src/lib/features.ts` guard navigation, direct pages, server actions, background work and AI permit issuance/consumption. The service worker mirrors the nutrition flag; a regression test keeps it aligned and verifies that legacy shares redirect without reading or caching photos. Code and existing records are retained. Export and account deletion still cover historical data. Re-enabling any deferred area requires a reviewed release and renewed flow testing.

Setup now asks for daily rhythm, optional work hours and planning preferences. It does not require body measurements, fitness goals or diet answers, and updates only scheduling fields. Planning controls live in Schedule; advanced planning and clearing are collapsed initially. Optional AI data choices live in Settings. Previously enabled upload consent remains visible for revocation.

Today has a useful non-AI empty state, no automatic check-in modal, no XP strip, and fewer repeated status panels. Habits and reflection share a simple two-column layout. Today queries use the profile timezone, including 23- and 25-hour daylight-saving days. Health insight metric labels are deduplicated and sleep-stage labels are readable. Menu navigation traps focus, supports Escape and restores focus to its opener.

App Store metadata, review notes, screenshot guidance and permission copy describe this reduced scope. Historical privacy inventories remain intact; hiding a feature does not erase retained data or change native HealthKit permissions.

## Verification

- Production Next.js build passed; no preview route is included.
- Typecheck, ESLint and 47 unit-test files / 332 tests passed.
- Regression coverage includes every deferred action, all nine deferred pages, AI-purpose blocking, legacy photo sharing, preference field preservation, and local-day/DST dashboard queries.
- Migration integrity and generated compliance checks passed during the scope implementation. Production rehearsal subsequently corrected three unapplied migrations and added explicit API table privileges; all 105 SQL assertions and eight upgrade scenarios now pass. Details are in the production release record.
- Release verifier: 22 passes, zero failures, 13 external-evidence blockers, one not-applicable gate. Its production-surface check now requires the three new flags to remain off.
- Browser component preview checked at 390 × 844: setup, optional work hours, collapsed advanced planning, Schedule, non-AI morning content, seven consent categories, menu contents, initial focus and Escape/focus restoration. Evidence images are local under `build/launch-scope-review/`.
- The browser preview used synthetic props and did not submit forms or generate AI content. Public landing-to-login navigation loaded. An installed password-manager extension injected DOM into Login and caused a hydration warning; clean-browser/native login needs separate verification. The app's theme nonce hydration warning was corrected without changing CSP enforcement.

## Remaining release work

1. Run signed-in core flows against an isolated test backend: signup/recovery, preferences, manual events, optional AI consent and planning, check-ins, health sync, export and deletion. Complete existing database/auth evidence gates and exact-commit CI.
2. Complete production identity, processor, legal/license/asset and App Store metadata approvals already tracked in the launch dashboard. Reconcile the final provider inventory with the reduced feature surface.
3. Produce the signed iOS candidate on the pinned macOS toolchain, reconcile its Xcode privacy report, and complete the physical-iPhone/TestFlight evidence matrix against that exact build.

The web changes are deployed; no build was submitted to App Store Connect. The production database was backed up, restored and rehearsed locally, then upgraded. Existing users must explicitly complete the new adult/legal prompt; AI consent starts denied. The preview route and local development server were removed after verification.
