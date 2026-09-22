import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export function installTarCompatibility() {
  // Capacitor 6 imports tar's default export. The security-patched tar 7
  // CommonJS build is marked __esModule but exposes only named exports.
  // Supply the legacy alias in this CLI process, retaining tar 7's extractor
  // and security checks. No dependency files or runtime app code are changed.
  const cliRequire = createRequire(require.resolve("@capacitor/cli/package.json"));
  const tar = cliRequire("tar");
  if (tar.__esModule && !tar.default) {
    if (typeof tar.extract !== "function") throw new Error("Unsupported tar extraction API");
    Object.defineProperty(tar, "default", { value: tar });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  installTarCompatibility();
  require("@capacitor/cli/bin/capacitor");
}
