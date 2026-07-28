# Security CI & supply chain

This describes the automated security checks for Daybreak.

## Checks

| Check                           | Workflow                 | Blocking    | What it does                                                                                                                      |
| ------------------------------- | ------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lockfile integrity              | `ci.yml`                 | yes         | `npm ci` + `git diff --exit-code package-lock.json` — the install must not mutate the lockfile, and it must match `package.json`. |
| Production dependency audit     | `ci.yml`, `security.yml` | yes         | `npm audit --omit=dev --audit-level=high` — fails on high/critical advisories in **shipped** dependencies.                        |
| Full dependency audit           | `security.yml`           | yes         | `npm audit --audit-level=moderate` over all deps, including native/build tooling.                                                 |
| Secret scanning                 | `security.yml`           | yes         | Pinned `gitleaks` binary (`v8.18.4`) scans history + working tree. No Action license required.                                    |
| Static analysis (SAST)          | `codeql.yml`             | yes\*       | CodeQL `javascript-typescript`, `security-and-quality` queries.                                                                   |
| Dependency review               | `security.yml`           | yes\* (PRs) | `actions/dependency-review-action` flags newly-added high-severity / denied deps.                                                 |
| Typecheck / lint / test / build | `ci.yml`                 | yes         | The existing quality gates.                                                                                                       |

\* CodeQL result upload and dependency-review require either a **public repo** or
**GitHub Advanced Security** (the dependency graph + code scanning). On a private
repo without GHAS these jobs cannot upload/evaluate; the `npm audit`, lockfile,
and gitleaks gates are unconditional and protect every push/PR regardless.

## Patched transitive compatibility overrides

The lockfile pins audited transitive releases through `package.json#overrides`:

- `postcss@8.5.24` and `sharp@0.35.3` replace vulnerable versions bundled by
  Next 16.2.12.
- `tar@7.5.22` replaces the vulnerable archive library under Capacitor CLI 6.
- `minimatch@10.2.6` and `brace-expansion@5.0.8` move the matching stack as a
  compatible pair; overriding only `brace-expansion` breaks older minimatch.

`npm audit`, ESLint, `next build`, `npx cap --version`, and `npx cap doctor` must
all pass after an override change. The signed Codemagic archive remains the
required proof that native template extraction and the final Xcode target work.
Do not run `npm audit fix --force`; it may replace framework/native majors.

## Codemagic (`codemagic.yaml`)

The iOS build uses the committed cross-platform lockfile with `npm ci`, Node 22,
and pinned Xcode 26.0. Any lockfile drift or native release-validation failure
stops the release build.

## Recommended branch protection (main)

Configure in GitHub → Settings → Branches → `main`:

- Require a pull request before merging (≥ 1 review).
- Require status checks to pass: **CI / verify**, **Security / gitleaks**,
  **Security / audit** (and **CodeQL** + **Security / dependency-review** once the
  repo is public or GHAS is enabled).
- Require branches to be up to date before merging.
- Block force-pushes and deletions on `main`.
- Enable secret scanning + push protection (GitHub native) if available.
