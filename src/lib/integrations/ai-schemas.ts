import { z } from "zod";
import { hasForbiddenMedicalDirective } from "./ai-boundary";

/**
 * Zod schemas for structured AI responses. Every model output that Daybreak
 * uses or stores is validated against one of these first (via
 * `safeParseAiJson`), so malformed JSON, oversized payloads, unexpected shapes,
 * or the narrow set of dangerous medical-override phrasings are rejected before
 * the data is trusted. Domain-specific post-processing (clamping, date checks)
 * still happens at the call site after validation.
 */

const NO_DIRECTIVE = "forbidden medical directive";
const noDirective = (s: string) => !hasForbiddenMedicalDirective(s);

/** User-facing model text: length-capped + medical-override backstop. */
function safeText(max: number) {
  return z.string().max(max).refine(noDirective, NO_DIRECTIVE);
}

const titleText = safeText(120);
const bodyText = safeText(1200);
const titleBody = z.object({ title: titleText, body: bodyText });

// ── Morning briefing ─────────────────────────────────────────────────────────
export const morningBriefingSchema = z.object({
  summary: bodyText,
  focus: safeText(400),
  insights: z.array(safeText(400)).max(8).default([]),
  recommendations: z.array(titleBody).max(8).default([]),
});
export type MorningBriefingOut = z.infer<typeof morningBriefingSchema>;

// ── Health analysis (shared by trends + fused) ───────────────────────────────
export const healthAnalysisSchema = z.object({
  summary: bodyText,
  insights: z.array(safeText(400)).max(8).default([]),
  suggestions: z.array(titleBody).max(8).default([]),
});
export type HealthAnalysisOut = z.infer<typeof healthAnalysisSchema>;

// ── Check-in coach reply ─────────────────────────────────────────────────────
export const checkinReplySchema = z.object({
  message: z.string().min(1).max(1200).refine(noDirective, NO_DIRECTIVE),
  action: z
    .object({
      title: z.string().max(120),
      durationMin: z.union([z.number(), z.string()]).optional(),
      time: z.string().optional(),
      daysOfWeek: z
        .array(z.union([z.number(), z.string()]))
        .max(7)
        .optional(),
    })
    .nullable()
    .optional(),
});
export type CheckinReplyOut = z.infer<typeof checkinReplySchema>;

// ── Weekly plan ──────────────────────────────────────────────────────────────
// Permissive on values the call site coerces/clamps (durationMin, type); strict
// on the presence/shape it relies on, plus length caps to bound the payload.
const planBlockSchema = z.object({
  date: z.string().max(40),
  start: z.string().max(10),
  durationMin: z.union([z.number(), z.string()]).optional(),
  title: z.string().max(200),
  type: z.string().max(40).optional(),
  note: z.string().max(400).optional(),
});
export const weeklyPlanSchema = z.object({
  blocks: z.array(planBlockSchema).max(80).default([]),
});
export type WeeklyPlanOut = z.infer<typeof weeklyPlanSchema>;

// ── Fitness plan ─────────────────────────────────────────────────────────────
// Lenient on the nested workout/nutrition shape (the call site maps defensively)
// but guarantees an object with a safe summary and no medical override.
export const fitnessPlanSchema = z.object({
  summary: bodyText,
  workout: z.object({}).passthrough().optional(),
  nutrition: z.object({}).passthrough().optional(),
});
export type FitnessPlanOut = z.infer<typeof fitnessPlanSchema>;

// ── Food vision ──────────────────────────────────────────────────────────────
const foodItemSchema = z.object({
  name: z.string().max(120).optional(),
  calories: z.unknown().optional(),
  protein_g: z.unknown().optional(),
  carbs_g: z.unknown().optional(),
  fat_g: z.unknown().optional(),
});
export const foodAnalysisSchema = z.object({
  description: z.string().max(300).optional(),
  items: z.array(foodItemSchema).max(50).optional(),
  calories: z.unknown().optional(),
  protein_g: z.unknown().optional(),
  carbs_g: z.unknown().optional(),
  fat_g: z.unknown().optional(),
  confidence: z.unknown().optional(),
});
export type FoodAnalysisOut = z.infer<typeof foodAnalysisSchema>;

// ── Receipt vision ───────────────────────────────────────────────────────────
const receiptItemSchema = z.object({
  name: z.string().max(160).optional(),
  price: z.unknown().optional(),
});
export const receiptAnalysisSchema = z.object({
  store: z.string().max(160).nullable().optional(),
  date: z.string().max(40).nullable().optional(),
  total: z.unknown().optional(),
  items: z.array(receiptItemSchema).max(400).optional(),
});
export type ReceiptAnalysisOut = z.infer<typeof receiptAnalysisSchema>;
