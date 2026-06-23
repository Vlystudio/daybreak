"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { analyzeFoodImage, type FoodAnalysis } from "@/lib/integrations/food-vision";
import type { ActionResult } from "@/actions/schedule";

/** YYYY-MM-DD for "now" in the user's timezone. */
async function localToday(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle<{ timezone: string }>();
  const tz = data?.timezone ?? "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date()
    );
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── food photo → nutrition ───────────────────────────────────────────────────

// ~7MB of base64 ≈ 5MB image; reject larger to keep the request sane.
const MAX_IMAGE_CHARS = 7_000_000;

export type AnalyzeResult = { ok: true; analysis: FoodAnalysis } | { ok: false; error: string };

export async function analyzeFoodPhoto(input: { imageDataUrl: string }): Promise<AnalyzeResult> {
  const user = await requireUser();

  const limited = await rateLimit(`vision:${user.id}`, RATE_LIMITS.aiVision);
  if (!limited.ok) return { ok: false, error: "You've analyzed a lot of photos — try again in a bit." };

  if (typeof input.imageDataUrl !== "string" || !input.imageDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "That doesn't look like an image." };
  }
  if (input.imageDataUrl.length > MAX_IMAGE_CHARS) {
    return { ok: false, error: "That image is a bit large — try a smaller photo." };
  }

  const analysis = await analyzeFoodImage(input.imageDataUrl);
  if (!analysis) return { ok: false, error: "Couldn't read that photo — log it manually below." };

  await audit(user.id, "food.analyzed", { metadata: { provider: analysis.provider } });
  return { ok: true, analysis };
}

// ── food log ─────────────────────────────────────────────────────────────────

const foodSchema = z.object({
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  description: z.string().trim().min(1).max(400),
  calories: z.number().int().min(0).max(20000).nullable(),
  protein_g: z.number().min(0).max(2000).nullable(),
  carbs_g: z.number().min(0).max(2000).nullable(),
  fat_g: z.number().min(0).max(2000).nullable(),
  source: z.enum(["manual", "photo"]).default("manual"),
});

export async function logFood(input: z.input<typeof foodSchema>): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those values look off." };

  const supabase = await createClient();
  const { error } = await supabase.from("food_logs").insert({
    user_id: user.id,
    date: await localToday(user.id),
    ...parsed.data,
  });
  if (error) return { ok: false, error: "Couldn't save that food entry." };

  await audit(user.id, "food.logged");
  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteFoodLog(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown entry" };

  const supabase = await createClient();
  const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove that entry." };

  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── water ──────────────────────────────────────────────────────────────────

export async function logWater(input: { amountMl: number }): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = z.object({ amountMl: z.number().int().min(1).max(5000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid amount" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("water_logs")
    .insert({ user_id: user.id, date: await localToday(user.id), amount_ml: parsed.data.amountMl });
  if (error) return { ok: false, error: "Couldn't log that water." };

  revalidatePath("/nutrition");
  return { ok: true };
}

// ── nutrition targets ────────────────────────────────────────────────────────

const goalsSchema = z.object({
  calories: z.number().int().min(0).max(20000).nullable(),
  protein_g: z.number().int().min(0).max(2000).nullable(),
  carbs_g: z.number().int().min(0).max(2000).nullable(),
  fat_g: z.number().int().min(0).max(2000).nullable(),
});

export async function setNutritionGoals(input: z.input<typeof goalsSchema>): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those targets look off." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("nutrition_goals")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Couldn't save your targets." };

  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── body measurement ─────────────────────────────────────────────────────────

const bodySchema = z.object({
  weight_kg: z.number().min(0).max(700).nullable(),
  body_fat_pct: z.number().min(0).max(80).nullable(),
  note: z.string().trim().max(300).optional(),
});

export async function logBodyMeasurement(input: z.input<typeof bodySchema>): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those values look off." };
  if (parsed.data.weight_kg == null && parsed.data.body_fat_pct == null) {
    return { ok: false, error: "Enter a weight or body-fat value." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("body_measurements").upsert(
    {
      user_id: user.id,
      date: await localToday(user.id),
      weight_kg: parsed.data.weight_kg,
      body_fat_pct: parsed.data.body_fat_pct,
      note: parsed.data.note?.length ? parsed.data.note : null,
    },
    { onConflict: "user_id,date" }
  );
  if (error) return { ok: false, error: "Couldn't save that measurement." };

  await audit(user.id, "body.logged");
  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { ok: true };
}
