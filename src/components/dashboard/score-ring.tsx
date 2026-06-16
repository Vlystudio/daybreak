"use client";

import { motion } from "framer-motion";

/** Animated radial score indicator (0-100). */
export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  color = "var(--primary)",
  label,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={label ?? (score != null ? `Score ${score} out of 100` : "No score yet")}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{score ?? "–"}</span>
      </div>
    </div>
  );
}

export function scoreTone(score: number | null): { word: string; color: string } {
  if (score == null) return { word: "No data yet", color: "var(--muted-foreground)" };
  if (score >= 85) return { word: "Excellent", color: "var(--sage)" };
  if (score >= 70) return { word: "Good", color: "var(--primary)" };
  if (score >= 60) return { word: "Fair", color: "var(--honey)" };
  return { word: "Take it easy", color: "var(--destructive)" };
}
