import { Sunrise } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/auth";
import { safePostAuthPath } from "@/lib/security/mfa";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Two-factor authentication" };
export const dynamic = "force-dynamic";

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  await requireAuthenticatedUser();
  const query = await searchParams;
  return (
    <main className="bg-sunrise-soft flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Sunrise className="text-primary h-5 w-5" aria-hidden /> Daybreak
          </div>
          <CardTitle>Confirm it’s you</CardTitle>
          <CardDescription>Enter the current code from your authenticator app.</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaChallengeForm nextPath={safePostAuthPath(query.next)} />
        </CardContent>
      </Card>
    </main>
  );
}
