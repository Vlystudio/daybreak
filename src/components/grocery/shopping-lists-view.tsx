"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createShoppingList, deleteShoppingList } from "@/actions/shopping";

export interface ShoppingListSummary {
  id: string;
  title: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
  itemCount: number;
}

export function ShoppingListsView({ lists }: { lists: ShoppingListSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");

  function create() {
    startTransition(async () => {
      const res = await createShoppingList(title.trim() || undefined);
      if (res.ok) {
        setTitle("");
        router.push(`/grocery/lists/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteShoppingList(id);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex gap-2 py-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder="New list name (optional)"
            maxLength={120}
          />
          <Button onClick={create} disabled={pending}>
            <Plus className="h-4 w-4" aria-hidden /> New list
          </Button>
        </CardContent>
      </Card>

      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shopping lists yet — create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => (
            <li key={list.id}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center gap-3 py-3">
                  <Link href={`/grocery/lists/${list.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{list.title || "Shopping list"}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.itemCount} {list.itemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    {list.status !== "active" && <Badge variant="secondary">{list.status}</Badge>}
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(list.id)}
                    disabled={pending}
                    aria-label="Delete list"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
