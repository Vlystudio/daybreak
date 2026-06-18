"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveGrocerySettings } from "@/actions/grocery";
import type { GrocerySettings } from "@/lib/grocery";

/** Inline editor for a string list (favorites / dislikes / allergies). */
function TagList({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    if (values.length >= 50) return;
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          maxLength={60}
        />
        <Button type="button" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="pr-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="rounded-full p-0.5 hover:bg-background/40"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function GrocerySettingsForm({ settings }: { settings: GrocerySettings | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [weeklyBudget, setWeeklyBudget] = useState(settings?.weekly_budget?.toString() ?? "");
  const [householdSize, setHouseholdSize] = useState((settings?.household_size ?? 1).toString());
  const [maxStores, setMaxStores] = useState((settings?.max_stores_per_trip ?? 2).toString());
  const [maxDistance, setMaxDistance] = useState(settings?.max_distance_miles?.toString() ?? "");
  const [favorites, setFavorites] = useState<string[]>(settings?.favorites ?? []);
  const [dislikes, setDislikes] = useState<string[]>(settings?.dislikes ?? []);
  const [allergies, setAllergies] = useState<string[]>(settings?.allergies ?? []);

  function save() {
    startTransition(async () => {
      const res = await saveGrocerySettings({
        weeklyBudget: weeklyBudget ? Number(weeklyBudget) : undefined,
        householdSize: Number(householdSize) || 1,
        maxStoresPerTrip: Number(maxStores) || 2,
        maxDistanceMiles: maxDistance ? Number(maxDistance) : undefined,
        favorites,
        dislikes,
        allergies,
      });
      if (res.ok) {
        toast.success("Preferences saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferences</CardTitle>
        <CardDescription>
          Budget and household details tune your meal plans and shopping lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weekly-budget">Weekly budget ($)</Label>
            <Input
              id="weekly-budget"
              type="number"
              min={0}
              inputMode="decimal"
              value={weeklyBudget}
              onChange={(e) => setWeeklyBudget(e.target.value)}
              placeholder="No limit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="household-size">Household size</Label>
            <Input
              id="household-size"
              type="number"
              min={1}
              max={30}
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-stores">Max stores per trip</Label>
            <Input
              id="max-stores"
              type="number"
              min={1}
              max={8}
              value={maxStores}
              onChange={(e) => setMaxStores(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-distance">Max distance (miles)</Label>
            <Input
              id="max-distance"
              type="number"
              min={0}
              inputMode="decimal"
              value={maxDistance}
              onChange={(e) => setMaxDistance(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>

        <TagList
          label="Favorites"
          placeholder="e.g. salmon"
          values={favorites}
          onChange={setFavorites}
        />
        <TagList
          label="Dislikes"
          placeholder="e.g. cilantro"
          values={dislikes}
          onChange={setDislikes}
        />
        <TagList
          label="Allergies"
          placeholder="e.g. peanuts"
          values={allergies}
          onChange={setAllergies}
        />

        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
