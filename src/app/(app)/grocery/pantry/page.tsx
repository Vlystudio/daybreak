import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PantryView } from "@/components/grocery/pantry-view";
import type { PantryItem } from "@/lib/grocery";

export const metadata = { title: "Pantry · Daybreak" };

export default async function PantryPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("pantry_items")
    .select("id, name, normalized_ingredient_id, quantity, unit, location, expiration_date, updated_at")
    .eq("user_id", user.id)
    .order("name")
    .returns<PantryItem[]>();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link
          href="/grocery"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Grocery
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pantry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What&apos;s in your kitchen. Items expiring soon are flagged.
        </p>
      </div>

      <PantryView items={items ?? []} />
    </div>
  );
}
