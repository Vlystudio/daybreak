import Link from "next/link";
import { Refrigerator, CalendarRange, ListChecks, Tag, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GrocerySettingsForm } from "@/components/grocery/grocery-settings-form";
import { StorePicker } from "@/components/grocery/store-picker";
import { Stagger, StaggerItem } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import type { GrocerySettings, Store } from "@/lib/grocery";

const SECTIONS = [
  {
    href: "/grocery/plan",
    label: "Meal plan",
    blurb: "Generate a week of meals around your budget and tastes.",
    icon: CalendarRange,
    tint: "bg-honey-soft text-[#9a6b1f]",
  },
  {
    href: "/grocery/lists",
    label: "Shopping lists",
    blurb: "Build a list and find the cheapest way to shop it.",
    icon: ListChecks,
    tint: "bg-sky-soft text-[#44607a]",
  },
  {
    href: "/grocery/pantry",
    label: "Pantry",
    blurb: "Track what you have and what's about to expire.",
    icon: Refrigerator,
    tint: "bg-sage-soft text-[#4f6b4b]",
  },
  {
    href: "/grocery/prices",
    label: "Prices",
    blurb: "Log prices so store comparisons get smarter.",
    icon: Tag,
    tint: "bg-secondary text-secondary-foreground",
  },
] as const;

export const metadata = { title: "Grocery" };

export default async function GroceryPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: settings }, { data: stores }, { data: userStores }] = await Promise.all([
    supabase
      .from("grocery_settings")
      .select(
        "weekly_budget, household_size, max_stores_per_trip, max_distance_miles, favorites, dislikes, allergies"
      )
      .eq("user_id", user.id)
      .maybeSingle<GrocerySettings>(),
    supabase
      .from("stores")
      .select("id, slug, name, default_pricing_source, website")
      .order("name")
      .returns<Store[]>(),
    supabase
      .from("user_stores")
      .select("store_id")
      .eq("user_id", user.id)
      .is("store_location_id", null)
      .returns<{ store_id: string }[]>(),
  ]);

  const enabledStoreIds = (userStores ?? []).map((s) => s.store_id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grocery</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Plan meals, track what&apos;s in your kitchen, and shop for less.
        </p>
      </div>

      <Stagger className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <StaggerItem key={section.href} className="h-full">
              <Link href={section.href} className="block h-full">
                <Card className="hover-lift hover:bg-accent/50 h-full transition-colors">
                  <CardContent className="flex items-center gap-3 py-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${section.tint}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{section.label}</p>
                      <p className="text-muted-foreground text-sm">{section.blurb}</p>
                    </div>
                    <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <StorePicker stores={stores ?? []} enabledStoreIds={enabledStoreIds} />
      <GrocerySettingsForm settings={settings ?? null} />
    </div>
  );
}
