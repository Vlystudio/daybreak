import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as prettier from "prettier";

const root = process.cwd();
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const lock = readJson("package-lock.json");
const policy = readJson("config/legal/license-policy.json");
const assets = readJson("config/legal/ip-assets.json");
const processors = readJson("config/privacy/processors.json");
const aiProviders = readJson("config/privacy/ai-providers.json");
const dataInventory = readJson("config/privacy/data-inventory.json");
const retention = readJson("config/privacy/retention-schedule.json");
const sdkInventory = readJson("config/privacy/ios-sdk-inventory.json");
const providerPackets = readJson("config/privacy/provider-approval-packets.json");

function packageName(packagePath, info) {
  if (info.name) return info.name;
  const marker = "node_modules/";
  const at = packagePath.lastIndexOf(marker);
  return at >= 0 ? packagePath.slice(at + marker.length) : packagePath;
}

function packageLicense(packagePath, info) {
  if (info.license) return info.license;
  if (info.link) return null;
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, packagePath, "package.json"), "utf8"));
    return pkg.license ?? pkg.licenses?.map((item) => item.type).join(" OR ") ?? null;
  } catch {
    return null;
  }
}

const packages = [];
const seen = new Set();
for (const [packagePath, info] of Object.entries(lock.packages)) {
  if (!packagePath || info.link) continue;
  const name = packageName(packagePath, info);
  const license = packageLicense(packagePath, info);
  const key = `${name}@${info.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  packages.push({ name, version: info.version ?? "unknown", license });
}
packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const unknown = packages.filter((pkg) => !pkg.license);
const prohibited = packages.filter(
  (pkg) =>
    pkg.license &&
    policy.prohibitedPatterns.some((pattern) => new RegExp(pattern, "i").test(pkg.license))
);
const manual = packages.filter((pkg) => policy.manualReviewRequired.includes(pkg.license));
const compound = packages.filter((pkg) => /\b(?:AND|OR)\b/.test(pkg.license ?? ""));
const unclassified = packages.filter(
  (pkg) =>
    pkg.license &&
    !policy.automaticallyAllowed.includes(pkg.license) &&
    !policy.manualReviewRequired.includes(pkg.license) &&
    !prohibited.includes(pkg)
);
if (unknown.length || prohibited.length || unclassified.length) {
  throw new Error(
    `License inventory failed: ${unknown.length} unknown, ${prohibited.length} prohibited, and ${unclassified.length} unclassified packages.`
  );
}

const generated = new Map();
generated.set(
  "THIRD_PARTY_NOTICES",
  [
    "DAYBREAK THIRD-PARTY NOTICES",
    "Generated from package-lock.json by scripts/generate-compliance-docs.mjs.",
    "Review the corresponding installed package for full license text and copyright notices.",
    "",
    ...packages.map((pkg) => `${pkg.name} ${pkg.version} — ${pkg.license}`),
    "",
  ].join("\n")
);

const assetRows = assets.assets.map(
  (asset) =>
    `| ${asset.category} | ${asset.name} | ${asset.filePaths.join("<br>") || "None"} | ${asset.creator} | ${asset.creationDate} | ${asset.license} | ${asset.commercialUse} | ${asset.modification} | ${asset.attributionRequired ? "Yes" : "No"} | ${asset.evidence ?? "External evidence required"} | ${asset.releaseStatus} |`
);
generated.set(
  "docs/legal/ip-and-license-inventory.md",
  `# IP and license inventory\n\nGenerated from \`config/legal/ip-assets.json\` and \`package-lock.json\`.\n\n## Asset inventory\n\n| Category | Name | Paths | Creator/source | Creation date | License/assignment | Commercial use | Modification | Attribution | Evidence | Release |\n|---|---|---|---|---|---|---|---|---|---|---|\n${assetRows.join("\n")}\n\n## Package summary\n\n- Unique package versions: ${packages.length}\n- Unknown licenses: ${unknown.length}\n- Prohibited licenses: ${prohibited.length}\n- Unclassified/custom licenses: ${unclassified.length}\n- Compound license expressions: ${compound.length}\n- License families requiring external review: ${[...new Set(manual.map((pkg) => pkg.license))].join(", ") || "None"}\n\nUnknown, prohibited, unclassified, and missing asset ownership evidence block release automatically. Manual-review packages remain blocked until the evidence paths in \`config/legal/license-policy.json\` are populated. Full package notices are in \`THIRD_PARTY_NOTICES\`.\n`
);

const obligationFor = (license) => {
  if (license.includes("LGPL"))
    return "Review dynamic-linking/relinking, license and copyright notices, modification disclosure, and corresponding-source/source-offer duties for the exact distributed form.";
  if (license === "MPL-2.0")
    return "Review file-level copyleft, source availability for modified covered files, notices, and incompatible secondary-license terms.";
  if (license === "FSL-1.1-MIT")
    return "Review the Functional Source License use restriction, change date, future MIT conversion, and whether distribution/use is permitted before that date.";
  if (license === "CC-BY-4.0")
    return "Review creator/title/source/license attribution, modification indication, link requirements, and database or moral-right considerations.";
  if (/\b(?:AND|OR)\b/.test(license))
    return "Confirm whether the expression is conjunctive or elective and satisfy every applicable notice, source, attribution, and distribution condition.";
  return "Qualified reviewer must identify attribution, source-offer, modification-notice, and distribution obligations.";
};
const manualRows = manual.map(
  (pkg) =>
    `| ${pkg.name} | ${pkg.version} | ${pkg.license} | ${obligationFor(pkg.license)} | ${policy.manualReviewEvidence[pkg.license] ?? "Missing — release blocker"} |`
);
generated.set(
  "docs/legal/license-review-package.md",
  `# Third-party license legal-review packet\n\nThis automated inventory identifies review candidates; it does not decide legal compliance. Review the exact installed license texts and distributed iOS/web artifacts.\n\n## Results\n\n- ${packages.length} unique package versions\n- ${manual.length} package versions require manual review\n- ${compound.length} compound expressions\n- ${unknown.length} unknown, ${unclassified.length} unclassified/custom, ${prohibited.length} prohibited-pattern findings\n\n## Manual-review packages\n\n| Package | Version | Expression | Questions/possible obligations | Approval evidence |\n|---|---|---|---|---|\n${manualRows.join("\n") || "| None | — | — | — | — |"}\n\n## Required reviewer decisions\n\nFor every row, record whether the shipped architecture triggers source-offer or relinking duties, whether files were modified, the exact notices/attribution to display or distribute, any use/field-of-use restriction, the approved evidence path, reviewer, date, scope, and revalidation date. Do not mark a family resolved only because another package with the same SPDX expression was reviewed.\n`
);

generated.set(
  "docs/legal/external-service-terms-inventory.md",
  `# External service terms inventory\n\nGenerated from the processor and AI provider registries. Approval means technical configuration alone is insufficient; contracts, terms, retention, and ownership require external evidence.\n\n| Provider | Service | Purpose | Contract | DPA | Approval | Evidence |\n|---|---|---|---|---|---|---|\n${processors.processors.map((p) => `| ${p.provider} | ${p.service} | ${p.purpose} | ${p.contractStatus} | ${p.dpaStatus} | ${p.approvalStatus} | ${p.evidence ?? "External evidence required"} |`).join("\n")}\n${aiProviders.providers.map((p) => `| ${p.providerName} | ${p.service} | ${p.purposes.join(", ")} | ${p.contractStatus} | ${p.dpaStatus} | ${p.approvalStatus} | External evidence required |`).join("\n")}\n`
);

generated.set(
  "docs/legal/processor-inventory.md",
  `# Processor inventory\n\n| ID | Provider | Data | Region | Retention | Deletion | Owner | Status |\n|---|---|---|---|---|---|---|---|\n${processors.processors.map((p) => `| ${p.id} | ${p.provider} | ${p.dataCategories.join(", ")} | ${p.region} | ${p.retention} | ${p.deletionSupport} | ${p.owner} | ${p.approvalStatus} |`).join("\n")}\n`
);

generated.set(
  "docs/legal/ai-provider-inventory.md",
  `# AI provider inventory\n\n| ID | Provider | Categories | Purposes | Retention | Training | Environments | Approval |\n|---|---|---|---|---|---|---|---|\n${aiProviders.providers.map((p) => `| ${p.id} | ${p.providerName} | ${p.dataCategories.join(", ")} | ${p.purposes.join(", ")} | ${p.retention} | ${p.trainingUse} | ${p.enabledEnvironments.join(", ")} | ${p.approvalStatus} |`).join("\n")}\n`
);

generated.set(
  "docs/legal/retention-schedule.md",
  `# Retention schedule\n\nGenerated from \`config/privacy/retention-schedule.json\`.\n\n| Category | Purpose | Active | Post-deletion | Mechanism | Backup | Job | Verification |\n|---|---|---|---|---|---|---|---|\n${retention.categories.map((c) => `| ${c.id} | ${c.purpose} | ${c.activeRetention} | ${c.postDeletionRetention} | ${c.deletionMechanism} | ${c.backupExpiration} | ${c.responsibleJob} | ${c.verification} |`).join("\n")}\n`
);

generated.set(
  "docs/privacy/data-flow-inventory.md",
  `# Daybreak data-flow inventory\n\nGenerated from \`config/privacy/data-inventory.json\`.\n\n| ID | Apple category | Source | Destination | Purpose | Stored | Linked | Tracking | Health/sensitive | Consent | Processor |\n|---|---|---|---|---|---:|---:|---:|---:|---|---|\n${dataInventory.dataTypes.map((d) => `| ${d.id} | ${d.appleCategory} | ${d.source.join(", ")} | ${d.destination.join(", ")} | ${d.purpose.join(", ")} | ${d.stored ? "Yes" : "No"} | ${d.linkedToIdentity ? "Yes" : "No"} | ${d.tracking ? "Yes" : "No"} | ${d.sensitiveHealth ? "Yes" : "No"} | ${d.consent} | ${d.processor.join(", ")} |`).join("\n")}\n`
);

const appleGroups = new Map();
for (const item of dataInventory.dataTypes) {
  const list = appleGroups.get(item.appleCategory) ?? [];
  list.push(item);
  appleGroups.set(item.appleCategory, list);
}
generated.set(
  "docs/app-store/app-privacy-answers.md",
  `# App Store privacy-answer evidence\n\nThis is a technical evidence draft, not an App Store Connect submission. Business/legal review is required. Daybreak declares no tracking and no sale.\n\n${[...appleGroups].map(([category, items]) => `## ${category}\n\n- Collected: Yes\n- Linked to the user: ${items.some((i) => i.linkedToIdentity) ? "Yes" : "No"}\n- Used for tracking: ${items.some((i) => i.tracking) ? "Yes" : "No"}\n- Purposes: ${[...new Set(items.flatMap((i) => i.purpose))].join(", ")}\n- Evidence records: ${items.map((i) => i.id).join(", ")}\n`).join("\n")}\n## Purchases\n\nNot collected in free V1. No StoreKit, billing SDK, or paid digital feature is configured. Re-review before enabling subscriptions.\n\n## Required business review\n\nConfirm Apple questionnaire category mapping, production processor approvals, diagnostics settings, and final archived SDK privacy report before submission.\n`
);

generated.set(
  "docs/app-store/ios-sdk-privacy-review.md",
  `# iOS SDK and privacy-manifest review\n\n| Target | SDK | Necessary | Manifest | Signature | Data | Domains | Tracking | Health transmission |\n|---|---|---:|---|---|---|---|---:|---:|\n${sdkInventory.targets.flatMap((target) => target.sdks.map((sdk) => `| ${target.target} | ${sdk.name} | ${sdk.necessary ? "Yes" : "No"} | ${sdk.manifestLocation} | ${sdk.signatureStatus} | ${sdk.data.join(", ")} | ${sdk.domains.join(", ") || "None"} | ${sdk.tracking ? "Yes" : "No"} | ${sdk.healthTransmission ? "Yes" : "No"} |`)).join("\n")}\n\nFinal signatures and dependency manifests must be verified from the signed archive and Xcode privacy report.\n`
);

const requiredProviderIds = [
  "openai",
  "logmeal",
  "supabase",
  "vercel",
  "sentry",
  "analytics_internal",
  "resend",
  "web_push",
  "apns",
  "supabase_storage",
  "oura",
  "fitbit",
  "garmin",
  "google_calendar",
  "customer_support",
];
const providerFields = [
  "id",
  "provider",
  "purpose",
  "dataCategories",
  "healthData",
  "calendarData",
  "directUserPrompts",
  "region",
  "retention",
  "trainingUse",
  "encryption",
  "subprocessors",
  "dpaStatus",
  "breachNotification",
  "deletionSupport",
  "securityReviewDate",
  "contractOwner",
  "productionApprovalStatus",
  "emergencyDisableProcedure",
];
const packetIds = new Set(providerPackets.providers.map(({ id }) => id));
const packetProblems = providerPackets.providers.flatMap((provider) =>
  providerFields
    .filter((field) => !(field in provider))
    .map((field) => `${provider.id ?? "unknown"}.${field}`)
);
for (const id of requiredProviderIds) if (!packetIds.has(id)) packetProblems.push(`missing:${id}`);
if (packetProblems.length > 0) {
  throw new Error(`Provider approval packet schema is incomplete: ${packetProblems.join(", ")}`);
}
for (const provider of providerPackets.providers) {
  generated.set(
    `docs/legal/vendor-review-packets/${provider.id}.md`,
    `# ${provider.provider} approval packet\n\nProduction status: **${provider.productionApprovalStatus}**. This packet is preparation only; no contract or security approval is implied.\n\n| Field | Recorded value |\n|---|---|\n| Purpose | ${provider.purpose} |\n| Data categories | ${provider.dataCategories.join(", ") || "None"} |\n| Health data | ${provider.healthData} |\n| Calendar data | ${provider.calendarData} |\n| Direct user prompts | ${provider.directUserPrompts ? "May be transmitted" : "Not transmitted"} |\n| Region | ${provider.region} |\n| Retention | ${provider.retention} |\n| Training/model improvement | ${provider.trainingUse} |\n| Encryption | ${provider.encryption} |\n| Subprocessors | ${provider.subprocessors} |\n| DPA | ${provider.dpaStatus} |\n| Breach notice | ${provider.breachNotification} |\n| Deletion | ${provider.deletionSupport} |\n| Security review date | ${provider.securityReviewDate ?? "Missing — release blocker if production provider"} |\n| Contract owner | ${provider.contractOwner} |\n| Emergency disable | ${provider.emergencyDisableProcedure} |\n\n## Owner decision\n\n- [ ] Confirm exact legal entity and service/product tier.\n- [ ] Review current terms, privacy terms, subprocessors, region, transfer mechanism, retention, deletion, breach notice, and security documentation.\n- [ ] Execute required contract/DPA and record its secure reference.\n- [ ] Assign an accountable owner, review date, expiration/revalidation date, and emergency-disable drill.\n- [ ] Approve the exact production data categories, or keep the integration disabled.\n`
  );
}
generated.set(
  "docs/legal/vendor-review-packets/README.md",
  `# Vendor and processor approval checklist\n\nGenerated from \`config/privacy/provider-approval-packets.json\`. These packets do not accept terms or approve a provider. AI and processor production use remains fail-closed until the corresponding structured registry has an assigned owner, production environment approval, evidence, and a current review.\n\n| ID | Provider | Health | Calendar | Prompts | Owner | Production status | Security review |\n|---|---|---|---|---|---|---|---|\n${providerPackets.providers.map((provider) => `| ${provider.id} | ${provider.provider} | ${provider.healthData} | ${provider.calendarData} | ${provider.directUserPrompts ? "Possible" : "No"} | ${provider.contractOwner} | ${provider.productionApprovalStatus} | ${provider.securityReviewDate ?? "Missing"} |`).join("\n")}\n\n## Owner workflow\n\n1. Route each production or proposed provider packet to legal, privacy, security, and the contract owner.\n2. Store confidential agreements outside Git; commit only non-secret evidence references and decisions.\n3. Reconcile approved data/regions/retention with the public policies, Apple privacy answers, iOS privacy manifest, deletion inventory, and incident plan.\n4. Exercise the emergency-disable procedure.\n5. Update both this packet source and the enforcement registry (\`processors.json\` or \`ai-providers.json\`) only after approval.\n6. Re-run \`npm run compliance:generate\` and \`npm run verify:app-store-sections-1-8\`.\n`
);

const check = process.argv.includes("--check");
const prettierConfig = (await prettier.resolveConfig(root)) ?? {};
let drift = 0;
for (const [file, rawContent] of generated) {
  const target = path.join(root, file);
  const content = file.endsWith(".md")
    ? await prettier.format(rawContent, { ...prettierConfig, filepath: target })
    : rawContent;
  if (check) {
    let current = "";
    try {
      current = readFileSync(target, "utf8");
    } catch {}
    if (current !== content) {
      console.error(`Generated compliance artifact is stale: ${file}`);
      drift++;
    }
  } else {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
    console.log(`Wrote ${file}`);
  }
}
if (check && drift) process.exit(1);
if (check) console.log(`Compliance artifacts match ${generated.size} structured sources.`);
