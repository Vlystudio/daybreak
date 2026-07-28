"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaChallengeForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      const factor = data?.totp?.find((candidate) => candidate.status === "verified");
      if (!error && factor) setFactorId(factor.id);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setPending(false);
    if (error) {
      toast.error("That authentication code was not accepted.");
      setCode("");
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  if (loading) return <p className="text-muted-foreground text-sm">Checking your account…</p>;
  if (!factorId) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          No verified authenticator is available. Sign out and contact support.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={verify} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">Six-digit authentication code</Label>
          <Input
            id="mfa-code"
            data-testid="mfa-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          id="mfa-submit"
          data-testid="mfa-submit"
          className="w-full"
          disabled={pending || code.length !== 6}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Verify
        </Button>
      </form>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full">
          Sign out instead
        </Button>
      </form>
    </div>
  );
}
