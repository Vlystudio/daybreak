# Dependency license assessment for free V1

Date: 2026-09-22. Reviewer: Codex, technical source/distribution review under
the owner's instruction to prepare and publish Daybreak. This is not an attorney
opinion, trademark clearance, or a claim that counsel approved the release.

Scope: the locked dependency versions, unmodified upstream packages, the hosted
Next.js app, and the Capacitor iOS shell. Reassess when dependencies, package
modifications, distribution model, or server-to-client imports change.

| License                                              | Packages and version                                                    | Actual use and decision                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LGPL-3.0-or-later                                    | `@img/sharp-libvips-*` 1.3.3                                            | Build-machine image generation and hosted Next.js image processing. These native libraries are not iOS frameworks or browser scripts. No changes to upstream library source. Accept this server/build use; distributing these libraries in a downloadable native product requires a new source/relinking assessment.                    |
| Apache-2.0 AND LGPL-3.0-or-later (with MIT for WASM) | `@img/sharp-win32-*`, `@img/sharp-wasm32` 0.35.4                        | Optional platform variants of the same image tooling, not shipped executable iOS dependencies. Same distribution limitation as above.                                                                                                                                                                                                   |
| FSL-1.1-MIT                                          | `@sentry/cli` and platform packages 2.58.6                              | Internal build tool. Daybreak is a wellness planner, does not expose this CLI as a service, and does not offer competing error-monitoring functionality. The installed license expressly permits internal use. Sentry runtime diagnostics remain disabled for launch.                                                                   |
| MPL-2.0                                              | `axe-core` 4.12.1; `lightningcss` and platform packages 1.32.0 / 1.33.0 | Development audit and CSS compilation dependencies, with no modified covered files or direct application imports. They are not delivered as client libraries.                                                                                                                                                                           |
| MPL-2.0                                              | `web-push` 3.6.7                                                        | Unmodified server-only notification implementation. Production web push is disabled. It is not imported into client components or the native shell. Retain the upstream license; reassess any client distribution or covered-source changes.                                                                                            |
| CC-BY-4.0                                            | `caniuse-lite` 1.0.30001810                                             | Browser compatibility data used by the compiler/Browserslist, not an app feature or redistributed data product. Attribution: Ben Briggs and caniuse contributors; source https://github.com/browserslist/caniuse-lite and https://caniuse.com/; no Daybreak changes to the dataset. The full CC BY 4.0 text is included in the notices. |

Evidence reviewed: `package-lock.json`, installed package manifests/licenses,
application imports, `next.config.ts`, `capacitor.config.ts`,
`scripts/generate-ios-assets.mjs`, and `scripts/build-third-party-notices.mjs`.
The generator includes full installed runtime/native notices, upstream supplements
for tarballs missing notices, and Geist/Geist Mono OFL notices. Linux CI and the
Vercel production build both pass this generator. Final native archive validation
must also confirm the generated notice file is bundled.

The owner attested to creating the brand/artwork. Lucide uses ISC, Framer Motion
uses MIT, and the unmodified self-hosted Geist fonts use SIL OFL 1.1. Their
notices are included. No purchased stock media or contractor deliverable was
found in the repository inventory.

References supporting the license interpretation:

- https://www.gnu.org/licenses/gpl-3.0.html (conveying versus network interaction)
- https://www.gnu.org/licenses/lgpl-3.0.html (additional permissions and combined works)
- https://www.mozilla.org/en-US/MPL/2.0/FAQ/ (server-side use and distribution)
- https://fsl.software/ and the exact installed `@sentry/cli/LICENSE`
- https://creativecommons.org/licenses/by/4.0/
- `config/legal/license-notices/sources.json` (upstream notice provenance)

Decision: these six license families are accepted for the specific unmodified
server/build/client distribution described here. This does not approve future
bundling of copyleft native libraries, competing FSL services, or removal of
attribution. No legal review by a human attorney is represented.
