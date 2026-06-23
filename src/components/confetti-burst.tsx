"use client";

import { useMemo } from "react";

/**
 * A lightweight, dependency-free confetti burst. Re-mount it (via a changing
 * `key`) to replay. Positions itself absolutely over the nearest relative
 * parent; purely decorative.
 */
const PALETTE = ["#e8964f", "#8faa8b", "#7d9bb8", "#f2b27e", "#e8b04f", "#d6568f", "#4f9d6a"];

export function ConfettiBurst({ pieces = 16 }: { pieces?: number }) {
  // Deterministic radial spread (biased upward) — pure, so it's render-safe.
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, i) => {
        const angle = (i / pieces) * Math.PI * 2;
        const dist = 78 + (i % 3) * 26;
        return {
          dx: Math.round(Math.cos(angle) * dist),
          dy: Math.round(Math.sin(angle) * dist) - 46,
          r: Math.round((i % 2 ? 1 : -1) * (200 + (i % 5) * 42)),
          color: PALETTE[i % PALETTE.length],
          delay: (i % 4) * 30,
          round: i % 2 === 0,
        };
      }),
    [pieces]
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center" aria-hidden>
      <div className="relative h-0 w-0">
        {bits.map((b, i) => (
          <span
            key={i}
            className="confetti-piece absolute h-2 w-2"
            style={
              {
                background: b.color,
                borderRadius: b.round ? "9999px" : "2px",
                "--dx": `${b.dx}px`,
                "--dy": `${b.dy}px`,
                "--r": `${b.r}deg`,
                animationDelay: `${b.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
