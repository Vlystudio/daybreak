import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Phase 2 native iOS shell (HealthKit continuous sync).
 * See docs/apple-health-phase-2.md for the full setup runbook.
 *
 * The shell loads the deployed Daybreak web app remotely (server.url) so there's
 * one codebase and the Supabase session cookie is shared with the webview. The
 * only native code is the HealthKit plugin, which reads on-device and POSTs to
 * /api/ingest/apple-health.
 */
const config: CapacitorConfig = {
  appId: "app.daybreak.mobile",
  appName: "Daybreak",
  // Unused when server.url is set, but Capacitor requires it to exist.
  webDir: "public",
  server: {
    // Point at production (or a TestFlight/staging URL). For local device
    // testing against `next dev`, set this to http://<your-mac-LAN-ip>:3000
    // and add it to allowedNavigation + an ATS exception (see runbook).
    url: "https://daybreak-one.vercel.app",
    cleartext: false,
  },
  ios: {
    // Keep the WKWebView cookie store persistent so the Supabase auth session
    // survives app restarts.
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
