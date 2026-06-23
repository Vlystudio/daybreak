"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { analyzeFoodPhoto, logFood } from "@/actions/intake";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

function blobToDataUrl(blob: Blob, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
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

export function SharedFoodLogger() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState({ meal: guessMeal(), description: "", calories: "", protein: "", carbs: "", fat: "" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cache = await caches.open("daybreak-shared");
        const res = await cache.match("shared-image");
        if (!res) {
          if (!cancelled) setStatus("none");
          return;
        }
        const blob = await res.blob();
        await cache.delete("shared-image");
        const dataUrl = await blobToDataUrl(blob);
        if (cancelled) return;
        setPreview(dataUrl);
        const result = await analyzeFoodPhoto({ imageDataUrl: dataUrl });
        if (cancelled) return;
        if (result.ok) {
          const a = result.analysis;
          setDraft((d) => ({
            ...d,
            description: a.description,
            calories: a.calories != null ? String(Math.round(a.calories)) : "",
            protein: a.protein_g != null ? String(Math.round(a.protein_g)) : "",
            carbs: a.carbs_g != null ? String(Math.round(a.carbs_g)) : "",
            fat: a.fat_g != null ? String(Math.round(a.fat_g)) : "",
          }));
        } else {
          toast.error(result.error);
        }
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function num(s: string): number | null {
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function save() {
    if (!draft.description.trim()) return toast.error("Add a description first.");
    startTransition(async () => {
      const result = await logFood({
        meal: draft.meal,
        description: draft.description.trim(),
        calories: num(draft.calories) != null ? Math.round(num(draft.calories)!) : null,
        protein_g: num(draft.protein),
        carbs_g: num(draft.carbs),
        fat_g: num(draft.fat),
        source: "photo",
      });
      if (result.ok) {
        toast.success("Logged.");
        router.push("/nutrition");
      } else {
        toast.error(result.error);
      }
    });
  }

  if (status === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your photo…
        </CardContent>
      </Card>
    );
  }

  if (status === "none") {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">No shared photo found. Share a meal photo to Daybreak, or log it from the Nutrition page.</p>
          <Button onClick={() => router.push("/nutrition")} size="sm">
            Go to Nutrition
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Shared meal" className="h-40 w-full rounded-xl object-cover" />
        )}
        <div className="flex flex-wrap gap-1.5">
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, meal: m }))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                draft.meal === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <Input
          placeholder="What did you eat?"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
        <div className="grid grid-cols-4 gap-2">
          {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
            <div key={key}>
              <Label className="text-[11px] capitalize text-muted-foreground">{key === "calories" ? "kcal" : key}</Label>
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
          {pending ? <Check aria-hidden /> : <Plus aria-hidden />}
          {pending ? "Saving…" : "Log to today"}
        </Button>
      </CardContent>
    </Card>
  );
}
