import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const origin = "https://daybreak-one.vercel.app";
const routes = [
  ["/login", /Sign in/i],
  ["/support", /mailto:/i],
  ["/privacy", /Privacy Policy/i],
  ["/terms", /Terms of Service/i],
  ["/legal/consumer-health-privacy", /Consumer Health/i],
];

// This verifies the existing web deployment from a native-only build machine.
// Server secrets remain on Vercel. This is not a production-approval check.
export async function verifyRuntime(fetchImpl = fetch) {
  const checks = [];
  for (const [route, expected] of routes) {
    const response = await fetchImpl(`${origin}${route}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    checks.push({
      route,
      status:
        response.status === 200 &&
        response.headers.get("content-type")?.includes("text/html") &&
        expected.test(body) &&
        !/Application error:|Legal configuration is incomplete/i.test(body)
          ? "pass"
          : "fail",
      httpStatus: response.status,
    });
  }
  const response = await fetchImpl(`${origin}/manifest.webmanifest`, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const manifest = response.status === 200 ? await response.json() : null;
  checks.push({
    route: "/manifest.webmanifest",
    status: manifest?.name === "Daybreak" && !manifest.share_target ? "pass" : "fail",
    httpStatus: response.status,
  });
  return checks;
}

async function main() {
  const capacitor = readFileSync("capacitor.config.ts", "utf8");
  if (!capacitor.includes(`url: "${origin}"`) || !capacitor.includes("cleartext: false")) {
    throw new Error("Native shell must use the reviewed HTTPS production origin.");
  }
  const checks = await verifyRuntime();
  const processors = JSON.parse(readFileSync("config/privacy/processors.json", "utf8"));
  const providers = JSON.parse(readFileSync("config/privacy/ai-providers.json", "utf8"));
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit:
      process.env.CM_COMMIT ||
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "internal-testflight-only",
    origin,
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    publicReleaseApproved: false,
    checks,
    approvals: [...processors.processors, ...providers.providers].map((item) => ({
      id: item.id,
      approvalStatus: item.approvalStatus,
      productionEnabled: item.enabledEnvironments.includes("production"),
    })),
    limitations: [
      "Public release remains gated by release:verify-production and launch evidence.",
      "No production secrets, authenticated user data, or legal acceptances are read by this check.",
      "Physical-device camera, HealthKit, and deletion checks remain pending until tested.",
    ],
  };
  mkdirSync("build/release-evidence", { recursive: true });
  writeFileSync(
    "build/release-evidence/internal-testflight-runtime.json",
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  for (const check of checks)
    console.log(`${check.status.toUpperCase()} ${check.route}: HTTP ${check.httpStatus}`);
  console.log("Internal TestFlight candidate only; public release is not approved by this check.");
  if (evidence.status !== "pass") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
