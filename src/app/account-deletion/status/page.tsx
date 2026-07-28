import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountDeletionStatus } from "@/lib/account-deletion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Account deletion status",
  robots: { index: false, follow: false },
};

export default async function AccountDeletionStatusPage() {
  const statusToken = (await cookies()).get("daybreak_deletion_status")?.value;
  const status = await getAccountDeletionStatus(createAdminClient(), statusToken);
  const completed = status?.status === "completed";
  const blocked = status?.status === "blocked";

  return (
    <main className="bg-sunrise-soft flex min-h-screen items-center justify-center px-6 py-12">
      {!completed && !blocked ? <meta httpEquiv="refresh" content="10" /> : null}
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            {completed ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
            ) : blocked ? (
              <ShieldAlert className="text-destructive h-10 w-10" aria-hidden />
            ) : (
              <Clock3 className="text-primary h-10 w-10" aria-hidden />
            )}
          </div>
          <CardTitle>
            {completed
              ? "Your Daybreak account was deleted"
              : blocked
                ? "Deletion needs privacy support"
                : status
                  ? "Account deletion is in progress"
                  : "Deletion status unavailable"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm">
          {completed ? (
            <p className="text-muted-foreground">
              Connected credentials, Daybreak records, stored files, and your authentication account
              have been removed. The non-identifying completion receipt expires automatically.
            </p>
          ) : blocked ? (
            <p className="text-muted-foreground">
              Automatic retries could not finish one step. Your account remains disabled and no
              integrations, AI processing, or app access can resume. Contact privacy support so the
              deletion can be completed.
            </p>
          ) : status ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Your sessions are revoked and the account is disabled while the deletion worker
                safely retries any unavailable provider.
              </p>
              <p aria-live="polite">
                Current step: <span className="font-medium">{status.currentStep}</span>
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              This browser does not have a valid deletion-status receipt. If you requested deletion
              elsewhere, check that browser or contact privacy support.
            </p>
          )}
          <Button asChild variant="outline">
            <Link href="/">Return to Daybreak</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
