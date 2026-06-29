# Security CI & supply chain

This describes the automated security checks for Daybreak and the few known,
intentionally-deferred items.

## Checks

| Check                           | Workflow                 | Blocking           | What it does                                                                                                                      |
| ------------------------------- | ------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Lockfile integrity              | `ci.yml`                 | yes                | `npm ci` + `git diff --exit-code package-lock.json` — the install must not mutate the lockfile, and it must match `package.json`. |
| Production dependency audit     | `ci.yml`, `security.yml` | yes                | `npm audit --omit=dev --audit-level=high` — fails on high/critical advisories in **shipped** dependencies.                        |
| Full dependency audit           | `security.yml`           | no (informational) | `npm audit --audit-level=moderate` over all deps, including dev tooling.                                                          |
| Secret scanning                 | `security.yml`           | yes                | Pinned `gitleaks` binary (`v8.18.4`) scans history + working tree. No Action license required.                                    |
| Static analysis (SAST)          | `codeql.yml`             | yes\*              | CodeQL `javascript-typescript`, `security-and-quality` queries.                                                                   |
| Dependency review               | `security.yml`           | yes\* (PRs)        | `actions/dependency-review-action` flags newly-added high-severity / denied deps.                                                 |
| Typecheck / lint / test / build | `ci.yml`                 | yes                | The existing quality gates.                                                                                                       |

\* CodeQL result upload and dependency-review require either a **public repo** or
**GitHub Advanced Security** (the dependency graph + code scanning). On a private
repo without GHAS these jobs cannot upload/evaluate; the `npm audit`, lockfile,
and gitleaks gates are unconditional and protect every push/PR regardless.

## Known advisory: `@capacitor/cli` → `tar` (deferred)

`npm audit` reports a **high** advisory in `tar`, pulled in by **`@capacitor/cli`**,
which is a **devDependency** used only to build the iOS shell locally / on
Codemagic. It is **not part of the deployed web runtime**, so it is excluded from
the blocking gate via `--omit=dev`.

The only fix is a **breaking major upgrade of `@capacitor/cli` (8.x)**. That is
deferred because it requires re-testing the native iOS build + a Codemagic /
TestFlight rebuild, which belongs in the native-shell pass (Pass 3), not a CI
change. **Do not run `npm audit fix --force`** — it would force the breaking
upgrade unreviewed. (`next` → `postcss` is moderate-only and resolves on the next
Next.js patch.)

## Codemagic (`codemagic.yaml`)

The iOS build currently uses `npm install` (not `npm ci`) because the
`package-lock.json` is generated on Windows and omits macOS-only optional
dependencies, which makes `npm ci` fail on the macOS runner.

**TODO (Pass 3 / native):** regenerate `package-lock.json` on macOS (or with all
platforms resolved) so Codemagic can use `npm ci` for a deterministic install,
and pin the Xcode version (currently `latest`). Until then the GitHub CI
`npm ci` gate guarantees the lockfile is valid for the Linux/web build.

## Recommended branch protection (main)

Configure in GitHub → Settings → Branches → `main`:

- Require a pull request before merging (≥ 1 review).
- Require status checks to pass: **CI / verify**, **Security / gitleaks**,
  **Security / audit** (and **CodeQL** + **Security / dependency-review** once the
  repo is public or GHAS is enabled).
- Require branches to be up to date before merging.
- Block force-pushes and deletions on `main`.
- Enable secret scanning + push protection (GitHub native) if available.
