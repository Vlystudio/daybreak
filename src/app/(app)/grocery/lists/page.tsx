import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShoppingListsView, type ShoppingListSummary } from "@/components/grocery/shopping-lists-view";

export const metadata = { title: "Shopping lists · Daybreak" };

interface ListRow {
  id: string;
  title: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
  shopping_list_items: { count: number }[];
}

export default async function ShoppingListsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("shopping_lists")
    .select("id, title, status, created_at, shopping_list_items(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ListRow[]>();

  const lists: ShoppingListSummary[] = (data ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    created_at: l.created_at,
    itemCount: l.shopping_list_items?.[0]?.count ?? 0,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link
          href="/grocery"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Grocery
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Shopping lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build a list, then let Daybreak find the cheapest way to shop it.
        </p>
      </div>

      <ShoppingListsView lists={lists} />
    </div>
  );
}
