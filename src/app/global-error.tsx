"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for a crash in the root layout itself (where the normal
 * (app)/error.tsx can't reach). It replaces the whole document, so it carries
 * its own inline styles rather than relying on the app's CSS being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[global] fatal error:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f3e7c9",
          color: "#5a3d1a",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Something went wrong</h2>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", opacity: 0.8, margin: 0 }}>
          Daybreak ran into an unexpected problem. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            border: "none",
            borderRadius: "9999px",
            padding: "0.55rem 1.25rem",
            background: "#5a3d1a",
            color: "#fff",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
