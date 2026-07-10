"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Droplets, Scale, Utensils, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoCaptureField } from "@/components/ui/photo-capture-field";
import { cn } from "@/lib/utils";
import {
  analyzeFoodPhoto,
  logFood,
  deleteFoodLog,
  logWater,
  logBodyMeasurement,
} from "@/actions/intake";
import type { FoodLog, BodyMeasurement } from "@/lib/types";
import type { FoodAnalysis } from "@/lib/integrations/food-vision";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
const KG_PER_LB = 0.45359237;

/** Downscale an image file to a compact JPEG data URL for analysis. */
function fileToDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

function macroLine(f: {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}) {
  const parts: string[] = [];
  if (f.calories != null) parts.push(`${Math.round(f.calories)} kcal`);
  if (f.protein_g != null) parts.push(`${Math.round(f.protein_g)}p`);
  if (f.carbs_g != null) parts.push(`${Math.round(f.carbs_g)}c`);
  if (f.fat_g != null) parts.push(`${Math.round(f.fat_g)}f`);
  return parts.join(" · ");
}

export function NutritionView({
  foods,
  waterMl,
  latestBody,
}: {
  foods: FoodLog[];
  waterMl: number;
  latestBody: BodyMeasurement | null;
}) {
  const totals = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.calories ?? 0),
      protein: acc.protein + (f.protein_g ?? 0),
      carbs: acc.carbs + (f.carbs_g ?? 0),
      fat: acc.fat + (f.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="space-y-4">
      <TotalsCard totals={totals} />
      <FoodLogger />
      <TodayFoods foods={foods} />
      <div className="grid gap-4 sm:grid-cols-2">
        <WaterCard waterMl={waterMl} />
        <WeightCard latestBody={latestBody} />
      </div>
    </div>
  );
}

function TotalsCard({
  totals,
}: {
  totals: { calories: number; protein: number; carbs: number; fat: number };
}) {
  const stat = (label: string, value: string) => (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
  return (
    <Card className="bg-sunrise border-none text-[#5a3d1a]">
      <CardContent className="grid grid-cols-4 gap-2 py-5 text-center">
        {stat("calories", String(Math.round(totals.calories)))}
        {stat("protein", `${Math.round(totals.protein)}g`)}
        {stat("carbs", `${Math.round(totals.carbs)}g`)}
        {stat("fat", `${Math.round(totals.fat)}g`)}
      </CardContent>
    </Card>
  );
}

function FoodLogger() {
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<{
    meal: Meal;
    description: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    source: "manual" | "photo";
  }>({
    meal: guessMeal(),
    description: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    source: "manual",
  });
  const [pending, startTransition] = useTransition();

  async function analyzePhoto(file: File) {
    setAnalyzing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await analyzeFoodPhoto({ imageDataUrl: dataUrl });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const a: FoodAnalysis = result.analysis;
      setDraft((d) => ({
        ...d,
        description: a.description,
        calories: a.calories != null ? String(Math.round(a.calories)) : "",
        protein: a.protein_g != null ? String(Math.round(a.protein_g)) : "",
        carbs: a.carbs_g != null ? String(Math.round(a.carbs_g)) : "",
        fat: a.fat_g != null ? String(Math.round(a.fat_g)) : "",
        source: "photo",
      }));
      toast.success(`Identified: ${a.description}. Adjust if needed, then log it.`);
    } catch {
      toast.error("Couldn't read that image.");
    } finally {
      setAnalyzing(false);
    }
  }

  function num(s: string): number | null {
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function save() {
    if (!draft.description.trim()) {
      toast.error("Add a description first.");
      return;
    }
    startTransition(async () => {
      const result = await logFood({
        meal: draft.meal,
        description: draft.description.trim(),
        calories: num(draft.calories) != null ? Math.round(num(draft.calories)!) : null,
        protein_g: num(draft.protein),
        carbs_g: num(draft.carbs),
        fat_g: num(draft.fat),
        source: draft.source,
      });
      if (result.ok) {
        toast.success("Logged.");
        setDraft({
          meal: draft.meal,
          description: "",
          calories: "",
          protein: "",
          carbs: "",
          fat: "",
          source: "manual",
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Utensils className="text-primary h-4 w-4" aria-hidden />
          Log food
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* On web (desktop/Android/iOS Safari/PWA) this opens an in-app live
            camera; inside the native iOS shell it opens the OS picker (Photo
            Library / Take Photo). Never uses capture="environment" — forcing the
            camera on tap crashes stale iOS builds. */}
        <PhotoCaptureField
          onFile={analyzePhoto}
          busy={analyzing}
          label="Snap or upload a photo"
          busyLabel="Analyzing photo…"
          variant="secondary"
          className="w-full"
          fileName="meal.jpg"
        />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meal">
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, meal: m }))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                draft.meal === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {m}
            </button>
          ))}
          {draft.source === "photo" && (
            <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-xs">
              <Sparkles className="text-honey h-3 w-3" aria-hidden /> from photo
            </span>
          )}
        </div>

        <Input
          placeholder="What did you eat?"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["calories", "kcal"],
              ["protein", "protein"],
              ["carbs", "carbs"],
              ["fat", "fat"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label className="text-muted-foreground text-[11px]">{label}</Label>
              <Input
                inputMode="numeric"
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="px-2 text-center tabular-nums"
              />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={pending} className="w-full">
          <Plus aria-hidden />
          {pending ? "Saving…" : "Add to today"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TodayFoods({ foods }: { foods: FoodLog[] }) {
  const [pending, startTransition] = useTransition();

  if (foods.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Nothing logged yet today. Snap a photo or add a meal above.
        </CardContent>
      </Card>
    );
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteFoodLog(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Today</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {foods.map((f) => (
          <div
            key={f.id}
            className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.description}</p>
              <p className="text-muted-foreground text-xs capitalize">
                {f.meal}
                {macroLine(f) ? ` · ${macroLine(f)}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => remove(f.id)}
              aria-label={`Remove ${f.description}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WaterCard({ waterMl }: { waterMl: number }) {
  const [pending, startTransition] = useTransition();
  const glasses = Math.round((waterMl / 250) * 10) / 10;

  function add(amountMl: number) {
    startTransition(async () => {
      const result = await logWater({ amountMl });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplets className="text-sky h-4 w-4" aria-hidden />
          Water
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums">
          {(waterMl / 1000).toFixed(1)}L{" "}
          <span className="text-muted-foreground text-sm font-normal">· {glasses} glasses</span>
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => add(250)}>
            + Glass
          </Button>
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => add(500)}>
            + Bottle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WeightCard({ latestBody }: { latestBody: BodyMeasurement | null }) {
  const [unit, setUnit] = useState<"lb" | "kg">("lb");
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [pending, startTransition] = useTransition();

  const latestDisplay =
    latestBody?.weight_kg != null
      ? unit === "lb"
        ? `${Math.round((latestBody.weight_kg / KG_PER_LB) * 10) / 10} lb`
        : `${Math.round(latestBody.weight_kg * 10) / 10} kg`
      : null;

  function save() {
    const w = parseFloat(weight);
    const bf = parseFloat(bodyFat);
    const weightKg = isFinite(w) ? (unit === "lb" ? w * KG_PER_LB : w) : null;
    startTransition(async () => {
      const result = await logBodyMeasurement({
        weight_kg: weightKg,
        body_fat_pct: isFinite(bf) ? bf : null,
      });
      if (result.ok) {
        toast.success("Saved.");
        setWeight("");
        setBodyFat("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="text-sage h-4 w-4" aria-hidden />
          Weight
        </CardTitle>
        <div className="flex rounded-full border p-0.5 text-xs">
          {(["lb", "kg"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={cn(
                "rounded-full px-2 py-0.5",
                unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {latestDisplay && <p className="text-muted-foreground text-xs">Last: {latestDisplay}</p>}
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder={`Weight (${unit})`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="tabular-nums"
          />
          <Input
            inputMode="decimal"
            placeholder="Body fat %"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <Button
          onClick={save}
          disabled={pending || (!weight && !bodyFat)}
          size="sm"
          className="w-full"
        >
          {pending ? "Saving…" : "Log"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Best-guess meal from the local hour, so the right chip is preselected. */
function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}
