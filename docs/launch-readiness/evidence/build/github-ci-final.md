# GitHub CI evidence

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

## Owner action for the remaining GitHub gate

In repository **Settings → Security → Code security and analysis**, enable the
Dependency graph, then rerun the failed `dependency-review` job/workflow for the
current pull-request commit. Confirm it completes without high-severity findings.
Do not make the workflow non-blocking as a substitute.
