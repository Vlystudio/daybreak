import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { installTarCompatibility } from "./capacitor-cli.mjs";

const require = createRequire(import.meta.url);

it("extracts the real Capacitor iOS template using the patched archive library", async () => {
  installTarCompatibility();
  installTarCompatibility();
  const { extractTemplate } = require("@capacitor/cli/dist/util/template.js");
  const archive = require.resolve("@capacitor/cli/assets/ios-pods-template.tar.gz");
  const destination = await mkdtemp(path.join(tmpdir(), "daybreak-capacitor-template-"));
  try {
    await extractTemplate(archive, destination);
    expect(await readFile(path.join(destination, "App/App/Info.plist"), "utf8")).toContain(
      "CFBundleIdentifier"
    );
    expect(
      await readFile(path.join(destination, "App/App.xcodeproj/project.pbxproj"), "utf8")
    ).toContain("PBXProject");
    expect(require("tar/package.json").version).toBe("7.5.22");
  } finally {
    // Only the exact fresh directory returned by mkdtemp is removed.
    await rm(destination, { recursive: true, force: true });
  }
});
