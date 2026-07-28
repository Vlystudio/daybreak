import type { NextConfig } from "next";

const securityHeaders = [
  // NOTE: Content-Security-Policy is set per-request in src/proxy.ts so it can
  // carry a fresh nonce (script-src 'nonce-…' 'strict-dynamic'). Keeping it out
  // of here avoids emitting a second, weaker CSP header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Allow same-origin camera/mic: the app captures meal & receipt photos and may
  // use live capture later. `camera=()` forbade getUserMedia outright, which is
  // wrong for a camera-centric app. (Note: this header governs the getUserMedia
  // API, NOT the native <input type="file"> "Take Photo" picker.)
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self), payment=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Apple Health imports POST parsed data in chunks; raise the 1MB default so
    // each chunk has headroom (the client still batches well under this).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
