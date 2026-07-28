# Final automated verification

Executed: 2026-07-28 (America/New_York)

These results apply to the completed implementation candidate derived from base
commit `ed6923fd407f78f4708982ef42a907bf2dbdabd2`. The release-verifier JSON is
regenerated after commit and records the exact clean `HEAD`. No external/manual
item is promoted to pass.

| Command/check                                                        | Result                                                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm 10.9.8 `ci --no-audit --no-fund` plus before/after lock SHA-256  | PASS — 785 packages; lock hash remained `C448F0DF2FF5AA84AA8A58B431D940859E836AC91B3D385226BF6A6303B4DF74`.                                                                           |
| `npm run typecheck`                                                  | PASS — Next route types and TypeScript.                                                                                                                                               |
| `npm run lint`                                                       | PASS.                                                                                                                                                                                 |
| `npm run test:run`                                                   | PASS — 39 files / 252 tests.                                                                                                                                                          |
| `npm run compliance:generate` then `npm run compliance:check`        | PASS — 30 generated artifacts match structured sources.                                                                                                                               |
| `npm run check:migrations`                                           | PASS — 53 unique versions; both historical `0021` hashes preserved.                                                                                                                   |
| `npm run migration:discover:static`                                  | PASS — 53 active migrations and two historical `0021` fingerprints; read-only static mode.                                                                                            |
| `npm run verify:app-store-sections-1-8 -- --allow-external-blockers` | PASS as a repository gate — 22 automatic pass, 0 fail, 13 external/manual blocked, 1 not applicable; 34 required artifacts confirmed.                                                 |
| `npm audit --audit-level=high`                                       | PASS — 0 vulnerabilities.                                                                                                                                                             |
| `npm audit --omit=dev --audit-level=high`                            | PASS — 0 vulnerabilities.                                                                                                                                                             |
| `npx --yes @secretlint/quick-start "**/*" --maskSecrets`             | PASS — no finding output.                                                                                                                                                             |
| Pinned Gitleaks 8.18.4 `detect --source . --redact`                  | PASS — 165 commits scanned; no leaks found.                                                                                                                                           |
| CI-only CodeQL/dependency review                                     | CONFIGURED/BLOCKED — requires the final pushed commit and GitHub runners.                                                                                                             |
| `npm run build`                                                      | PASS — Next.js 16.2.12 production build and all listed routes.                                                                                                                        |
| Built-server browser checks                                          | PASS — meaningful content, navigation, interactive controls, unchecked attestations, public legal/security routes, no overlay/browser/console errors; screenshots visually inspected. |
| iOS assets, Ruby/Node/Python syntax, workflow YAML                   | PASS — 16 native asset hashes deterministic; Ruby syntax, 21 Node scripts, two Python utilities, Codemagic and GitHub YAML parse.                                                     |
| Physical-device form/blank-template validation                       | PASS — 70 rows generated; blank evidence rejected with 80 issues and exit 2.                                                                                                          |
| Production/Auth evidence validators                                  | PASS fail-closed behavior — production 0/36 and supplied Auth 3/22 settings remain `BLOCKED`, both exit 2.                                                                            |
| `npm run test:db:preflight`                                          | BLOCKED — Docker Engine unreachable because `WSLService` is disabled/stopped; no SQL/pgTAP success claim or remote command.                                                           |
| `npm run ios:validate`                                               | BLOCKED — signed archive validation requires macOS/Codemagic; the Windows WSL service cannot start.                                                                                   |

The default release verifier intentionally exits nonzero while any of the 13
external/manual gates remain. `--allow-external-blockers` is for repository CI
only; it never changes the gate statuses. The exact final commit and clean-tree
flag are retained in `build/release-evidence/app-store-sections-1-8.json` after
the last local run.
