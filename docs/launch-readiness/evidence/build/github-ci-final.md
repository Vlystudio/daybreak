# GitHub CI evidence

## Current runtime — September 22, 2026

Source `c1cb521` passed all required checks after the time-field sizing and
Plan preferences availability follow-ups:

| Workflow/job                 | Run / job                      | Result                                                                         |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| CI / verify                  | `35789988383` / `106955902129` | PASS: 361 tests in 52 files, TypeScript, lint, compliance and production build |
| CodeQL analysis              | `35789988324` / `106955901676` | PASS                                                                           |
| CodeQL PR assessment         | `106956367879`                 | PASS; prior conditional state-verification finding resolved                    |
| Security / audit             | `35789988312` / `106955902205` | PASS                                                                           |
| Security / dependency-review | `35789988312` / `106955901999` | PASS                                                                           |
| Security / gitleaks          | `35789988312` / `106955902174` | PASS                                                                           |

The repository dependency graph is now enabled. No check was disabled or bypassed.
The broad compliance inventory reports 26 passes, zero failures, nine external
evidence gaps and one not applicable; green CI does not mean those gaps are passes.
Subsequent simulator-capture-only and evidence commits have their own check runs.

## Historical snapshot — July 28, 2026

Observed: 2026-07-28 (America/New_York)

Branch: `codex/app-store-launch-readiness`

Pull request: [#15 — Prepare Daybreak launch blockers for deterministic review](https://github.com/Vlystudio/daybreak/pull/15)

Verified source commit: `f2b601dc471f64644663c230815b732ce471a5f5`

The branch was pushed normally; no merge, bypass, rerun, or required-check
override was performed. Public GitHub API status and authenticated job logs were
actively polled during this execution.

| Workflow/job                               |                    Run/job ID | Result  | Evidence                                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------: | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI / `verify`                              | `30390651835` / `90381078446` | PASS    | `npm ci`, lock integrity, production audit, typecheck, lint, 252 tests, repository compliance gates, and build completed successfully.                                                   |
| CodeQL / `Analyze (javascript-typescript)` | `30390651725` / `90381077457` | PASS    | JavaScript/TypeScript analysis completed successfully.                                                                                                                                   |
| Security / `audit`                         | `30390651714` / `90381078040` | PASS    | npm 10.9.8 clean install plus full moderate and production high audits passed.                                                                                                           |
| Security / `gitleaks`                      | `30390651714` / `90381078053` | PASS    | Pinned Gitleaks scan completed successfully.                                                                                                                                             |
| Security / `dependency-review`             | `30390651714` / `90381078052` | BLOCKED | GitHub reported that dependency review is unsupported because the repository dependency graph is disabled. This is a repository-owner setting, not a dependency finding or code failure. |

The first pushed candidate exposed an npm 11/npm 10 optional-dependency lockfile
difference. Authenticated logs identified missing `@emnapi/core` and
`@emnapi/runtime` entries. The lockfile was regenerated and locally installed
with the runner's exact npm 10.9.8 version; the subsequent CI and audit jobs above
passed. The dependency-review job was not weakened or marked successful.

## Historical owner action — resolved September 22

The dependency graph was enabled in repository **Settings → Security → Code
security and analysis**. The dependency-review workflow now passes without making
it non-blocking or overriding a failed check. No further owner action is pending
for this historical gate.
