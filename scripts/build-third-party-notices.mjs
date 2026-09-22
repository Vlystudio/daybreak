import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const sections = [];
const missing = [];
const seen = new Set();
const noticeRoot = path.join(root, "config/legal/license-notices");
const supplements = JSON.parse(readFileSync(path.join(noticeRoot, "sources.json"), "utf8"));

function installedNotice(directory, manifest) {
  const texts = [];
  function collect(current, prefix = "") {
    for (const file of readdirSync(current, { withFileTypes: true })) {
      const relative = `${prefix}${file.name}`;
      if (file.isFile() && /^(licen[cs]e|notice|copying)(?:[._-]|$)/i.test(file.name)) {
        texts.push(`${relative}\n${readFileSync(path.join(current, file.name), "utf8").trim()}`);
      } else if (file.isDirectory() && file.name !== "node_modules") {
        collect(path.join(current, file.name), `${relative}/`);
      }
    }
  }
  collect(directory);
  if (texts.length) return texts;

  // Some monorepo platform packages omit the root license from their tarball.
  // Reuse it only when the installed parent has the identical release version.
  const family = manifest.name.startsWith("@next/")
    ? "next"
    : manifest.name.startsWith("@rollup/rollup-")
      ? "rollup"
      : manifest.name.startsWith("@sentry/cli-")
        ? "@sentry/cli"
        : manifest.name === "@sentry/server-utils"
          ? "@sentry/core"
          : null;
  if (family) {
    const parent = path.join(root, "node_modules", family);
    const parentManifest = JSON.parse(readFileSync(path.join(parent, "package.json"), "utf8"));
    if (parentManifest.version !== manifest.version)
      throw new Error(`License family version mismatch: ${manifest.name}`);
    return installedNotice(parent, parentManifest);
  }
  if (["agent-base", "https-proxy-agent", "glob-to-regexp"].includes(manifest.name)) {
    const readme = readFileSync(path.join(directory, "README.md"), "utf8");
    const start = readme.search(/(?:^|\n)(?:## )?License\r?\n/);
    if (start >= 0 && readme.slice(start).includes("SOFTWARE")) return [readme.slice(start).trim()];
  }
  if (manifest.name === "esrecurse") {
    return [readFileSync(path.join(directory, "esrecurse.js"), "utf8").split("*/", 1)[0] + "*/"];
  }
  return [];
}

for (const [relative, entry] of Object.entries(lock.packages)) {
  // Include the native iOS dependency even though the web build treats it as dev tooling.
  if (
    !relative.startsWith("node_modules/") ||
    entry.link ||
    (entry.dev && relative !== "node_modules/@capacitor/ios")
  )
    continue;
  const directory = path.join(root, relative);
  if (!existsSync(directory)) continue; // Platform-specific optional dependency not in this artifact.
  const manifest = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
  const identity = `${manifest.name}@${manifest.version}`;
  if (seen.has(identity)) continue;
  seen.add(identity);
  const texts = installedNotice(directory, manifest);
  const supplement = supplements.find(
    (item) => item.name === manifest.name && item.version === manifest.version
  );
  if (supplement)
    texts.push(
      `Upstream notice: ${supplement.source}\n${readFileSync(path.join(noticeRoot, supplement.file), "utf8").trim()}`
    );
  if (!texts.length) {
    missing.push(identity);
    continue;
  }
  sections.push({
    identity,
    text: `${identity}\nLicense: ${manifest.license ?? entry.license}\n\n${texts.join("\n\n")}`,
  });
}
if (missing.length) throw new Error(`Missing full license notices: ${missing.join(", ")}`);
sections.sort((a, b) => a.identity.localeCompare(b.identity, "en"));
mkdirSync(path.join(root, "public"), { recursive: true });
writeFileSync(
  path.join(root, "public", "third-party-licenses.txt"),
  [
    "DAYBREAK — OPEN-SOURCE LICENSES AND NOTICES",
    "This distribution includes third-party software. The applicable copyright notices and license terms follow.",
    "The list includes web, server and native dependencies present in the build; a listed package need not execute on every platform.",
    ...sections.map(({ text }) => `\n${"=".repeat(72)}\n${text}`),
    "",
  ].join("\n")
);
console.log(`Included full license notices for ${sections.length} installed dependency versions.`);
