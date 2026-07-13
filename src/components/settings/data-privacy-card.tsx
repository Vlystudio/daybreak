"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportMyData, deleteMyAccount } from "@/actions/privacy";

export function DataPrivacyCard() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function onExport() {
    startTransition(async () => {
      const res = await exportMyData();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([JSON.stringify(res.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daybreak-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data is downloading.");
    });
  }

  function onDelete() {
    startTransition(async () => {
      // On success the action redirects away; only an error returns here.
      const res = await deleteMyAccount({ confirmation: confirmText });
      if (res && !res.ok) toast.error(res.error ?? "Couldn't delete your account.");
    });
  }

  return (
    <Card id="data-privacy">
      <CardHeader>
        <CardTitle>Data &amp; privacy</CardTitle>
        <CardDescription>
          Export everything Daybreak holds about you, or delete your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">Download a copy of your data as JSON.</p>
          <Button variant="outline" onClick={onExport} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            Export my data
          </Button>
        </div>

        <div className="border-destructive/30 bg-destructive/5 rounded-2xl border p-3">
          {!confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                Permanently delete your account and all your data.
              </p>
              <Button variant="destructive" onClick={() => setConfirming(true)} disabled={pending}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete account
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-destructive text-sm font-medium">
                This permanently erases your account and cannot be undone. Type DELETE to confirm.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="h-9 max-w-[160px]"
                  aria-label="Type DELETE to confirm"
                />
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  disabled={pending || confirmText !== "DELETE"}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  Permanently delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText("");
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
