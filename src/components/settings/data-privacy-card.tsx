"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createPrivacyRightsRequest,
  deleteMyAccount,
  exportMyData,
  listMyPrivacyRightsRequests,
  type PrivacyRightsRequestSummary,
} from "@/actions/privacy";

export function DataPrivacyCard() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [rightsRequests, setRightsRequests] = useState<PrivacyRightsRequestSummary[]>([]);
  const [requestType, setRequestType] = useState("access");
  const [requestScope, setRequestScope] = useState("consumer_health");
  const [jurisdictionCode, setJurisdictionCode] = useState("");

  useEffect(() => {
    void listMyPrivacyRightsRequests().then(setRightsRequests);
  }, []);

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
      const res = await deleteMyAccount({ confirmation: confirmText, password });
      if (res && !res.ok) toast.error(res.error ?? "Couldn't delete your account.");
    });
  }

  function onRightsRequest(appealOf?: string) {
    startTransition(async () => {
      const res = await createPrivacyRightsRequest({
        requestType: appealOf ? "appeal" : requestType,
        scope: requestScope,
        jurisdictionCode,
        appealOf,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRightsRequests((current) => [res.request, ...current]);
      toast.success(appealOf ? "Appeal submitted." : "Privacy request submitted.");
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
          <Button
            id="privacy-export"
            data-testid="privacy-export"
            variant="outline"
            onClick={onExport}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            Export my data
          </Button>
        </div>

        <div className="bg-muted/40 space-y-3 rounded-2xl border p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="text-primary mt-0.5 h-4 w-4" aria-hidden />
            <div>
              <p className="text-sm font-medium">Privacy and consumer-health rights</p>
              <p className="text-muted-foreground text-xs">
                Ask for access, correction, withdrawal, collection/sharing cessation, a processor
                list, or deletion review. Exercising a right does not reduce your service access.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Request
              <select
                className="bg-card mt-1 h-9 w-full rounded-lg border px-2 text-sm"
                value={requestType}
                onChange={(event) => setRequestType(event.target.value)}
              >
                <option value="confirmation">Confirm processing</option>
                <option value="access">Access my data</option>
                <option value="correction">Correct my data</option>
                <option value="deletion">Deletion review</option>
                <option value="withdraw_consent">Withdraw consent</option>
                <option value="cease_collection">Stop future collection</option>
                <option value="cease_sharing">Stop future sharing</option>
                <option value="third_party_list">Third-party list</option>
              </select>
            </label>
            <label className="text-xs">
              Scope
              <select
                className="bg-card mt-1 h-9 w-full rounded-lg border px-2 text-sm"
                value={requestScope}
                onChange={(event) => setRequestScope(event.target.value)}
              >
                <option value="consumer_health">Consumer health data</option>
                <option value="all_personal_data">All personal data</option>
              </select>
            </label>
            <label className="text-xs">
              Jurisdiction (optional)
              <Input
                value={jurisdictionCode}
                onChange={(event) => setJurisdictionCode(event.target.value.toUpperCase())}
                placeholder="US-WA"
                maxLength={6}
                className="mt-1 h-9"
              />
            </label>
          </div>
          <Button variant="outline" onClick={() => onRightsRequest()} disabled={pending}>
            Submit rights request
          </Button>

          {rightsRequests.length > 0 && (
            <div className="space-y-2" aria-label="Privacy request status">
              {rightsRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <span>
                    {request.request_type.replaceAll("_", " ")} ·{" "}
                    {request.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-muted-foreground">
                    Target response by {new Date(request.deadline_at).toLocaleDateString()}
                  </span>
                  {request.status === "denied" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRightsRequest(request.id)}
                      disabled={pending}
                    >
                      Appeal
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-destructive/30 bg-destructive/5 rounded-2xl border p-3">
          {!confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                Permanently delete your account and all your data.
              </p>
              <Button
                id="account-delete-start"
                data-testid="account-delete-start"
                variant="destructive"
                onClick={() => setConfirming(true)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Delete account
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-destructive text-sm font-medium">
                This revokes connected providers, signs out every session, and permanently erases
                your account. Enter your current password and type DELETE to confirm.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  data-testid="account-delete-password"
                  id="account-delete-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Current password"
                  type="password"
                  autoComplete="current-password"
                  className="h-9 max-w-[220px]"
                  aria-label="Current password"
                />
                <Input
                  data-testid="account-delete-confirmation"
                  id="account-delete-confirmation"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="h-9 max-w-[160px]"
                  aria-label="Type DELETE to confirm"
                />
                <Button
                  data-testid="account-delete-submit"
                  id="account-delete-submit"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={pending || confirmText !== "DELETE" || password.length === 0}
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
                    setPassword("");
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
