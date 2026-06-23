"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setAccent } from "@/actions/settings";

const ACCENTS = [
  { key: "sunrise", label: "Sunrise", color: "#e8964f" },
  { key: "coral", label: "Coral", color: "#f0683a" },
  { key: "berry", label: "Berry", color: "#d6568f" },
  { key: "grape", label: "Grape", color: "#8b6fd0" },
  { key: "ocean", label: "Ocean", color: "#3f8fd6" },
  { key: "forest", label: "Forest", color: "#4f9d6a" },
];

export function AccentPicker({ current }: { current: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();

  function choose(key: string) {
    const prev = selected;
    setSelected(key); // optimistic
    startTransition(async () => {
      const result = await setAccent(key);
      if (result.ok) {
        toast.success("Theme updated.");
        router.refresh();
      } else {
        setSelected(prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accent theme</CardTitle>
        <CardDescription>Pick the color that makes Daybreak feel like yours.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => choose(a.key)}
              disabled={pending}
              aria-label={a.label}
              aria-pressed={selected === a.key}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-colors",
                selected === a.key ? "border-foreground/40" : "border-transparent hover:border-border"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: a.color }}>
                {selected === a.key && <Check className="h-5 w-5 text-white" aria-hidden />}
              </span>
              <span className="text-xs text-muted-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
