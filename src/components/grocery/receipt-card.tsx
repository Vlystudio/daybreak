"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2, Plus, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { analyzeReceiptPhoto, logPurchase, deletePurchase } from "@/actions/grocery";

export interface PurchaseRow {
  id: string;
  store: string | null;
  purchased_on: string;
  total: number;
}

function fileToDataUrl(file: File, maxDim = 1400): Promise<string> {
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
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

export function ReceiptCard({
  weeklySpend,
  weeklyBudget,
  recent,
}: {
  weeklySpend: number;
  weeklyBudget: number | null;
  recent: PurchaseRow[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [draft, setDraft] = useState<{
    store: string;
    date: string;
    total: string;
    itemCount: number;
    source: "receipt" | "manual";
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const pct = weeklyBudget ? Math.min(100, Math.round((weeklySpend / weeklyBudget) * 100)) : 0;
  const over = weeklyBudget != null && weeklySpend > weeklyBudget;

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await analyzeReceiptPhoto({ imageDataUrl: dataUrl });
      if (!result.ok) return toast.error(result.error);
      const r = result.receipt;
      setDraft({
        store: r.store ?? "",
        date: r.date ?? today,
        total: r.total != null ? String(r.total) : "",
        itemCount: r.items.length,
        source: "receipt",
      });
      toast.success(
        `Read ${r.items.length} items${r.total != null ? ` · $${r.total.toFixed(2)}` : ""}. Confirm below.`
      );
    } catch {
      toast.error("Couldn't read that image.");
    } finally {
      setScanning(false);
    }
  }

  function startManual() {
    setDraft({ store: "", date: today, total: "", itemCount: 0, source: "manual" });
  }

  function save() {
    if (!draft) return;
    const total = parseFloat(draft.total);
    if (!isFinite(total) || total < 0) return toast.error("Enter a total.");
    startTransition(async () => {
      const result = await logPurchase({
        store: draft.store.trim() || undefined,
        purchasedOn: draft.date,
        total,
        items: [],
        source: draft.source,
      });
      if (result.ok) {
        toast.success("Purchase logged.");
        setDraft(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePurchase(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="text-primary h-4 w-4" aria-hidden />
          Grocery spend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">${weeklySpend.toFixed(2)}</span>
            <span className="text-muted-foreground text-xs">
              this week{weeklyBudget != null ? ` of $${weeklyBudget.toFixed(0)} budget` : ""}
            </span>
          </div>
          {weeklyBudget != null && (
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-sage")}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        {/* No `capture` attr — see nutrition-view: forcing the live camera crashes
            the iOS WKWebView host app; the plain picker is robust. */}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        {draft ? (
          <div className="bg-muted/30 space-y-2 rounded-xl border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-muted-foreground text-[11px]">Store</Label>
                <Input
                  value={draft.store}
                  onChange={(e) => setDraft({ ...draft, store: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-[11px]">Date</Label>
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-[11px]">Total ($)</Label>
              <Input
                inputMode="decimal"
                value={draft.total}
                onChange={(e) => setDraft({ ...draft, total: e.target.value })}
                className="tabular-nums"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={pending} size="sm" className="flex-1">
                {pending ? "Saving…" : "Log purchase"}
              </Button>
              <Button onClick={() => setDraft(null)} disabled={pending} size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={scanning}
              onClick={() => fileRef.current?.click()}
            >
              {scanning ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
              {scanning ? "Reading…" : "Scan receipt"}
            </Button>
            <Button variant="ghost" size="sm" onClick={startManual}>
              <Plus aria-hidden /> Manual
            </Button>
          </div>
        )}

        {recent.length > 0 && (
          <ul className="divide-border/60 divide-y text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-muted-foreground min-w-0 truncate">
                  {format(parseISO(p.purchased_on), "MMM d")}
                  {p.store ? ` · ${p.store}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">${p.total.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    aria-label="Remove"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
