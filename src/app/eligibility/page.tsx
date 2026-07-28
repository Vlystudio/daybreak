import { redirect } from "next/navigation";
import { Sunrise } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getAccountEligibility, isCurrentEligibility } from "@/lib/account-eligibility";
import { EligibilityForm } from "@/components/auth/eligibility-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Adult eligibility" };

export default async function EligibilityPage() {
  const user = await requireAuthenticatedUser();
  const eligibility = await getAccountEligibility(user.id);
  if (isCurrentEligibility(eligibility)) redirect("/dashboard");

  const unavailable =
    eligibility?.status === "restricted_minor" ||
    eligibility?.status === "suspended" ||
    eligibility?.status === "deletion_pending";

  return (
    <main className="bg-sunrise-soft flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Sunrise className="text-primary h-5 w-5" aria-hidden /> Daybreak
          </div>
          <CardTitle>
            {unavailable ? "This account is restricted" : "Confirm adult eligibility"}
          </CardTitle>
          <CardDescription>
            {unavailable
              ? "Daybreak cannot collect or process more information for this account."
              : "Existing accounts are not automatically treated as adults. Confirm the current requirements before using health, calendar, planning, integration, or AI features."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unavailable ? (
            <p className="text-sm">
              Sign out and contact support if you believe this restriction is an error. A pending
              deletion request cannot be bypassed from this screen.
            </p>
          ) : (
            <EligibilityForm />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
