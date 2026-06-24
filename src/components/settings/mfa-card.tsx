"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Opt-in TOTP enrollment via Supabase MFA. Enrolling + verifying a factor works
 * end-to-end here. Requiring the factor at sign-in (AAL2 enforcement) is a
 * separate step handled at the auth gate.
 */
export function MfaCard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(
    null
  );
  const [code, setCode] = useState("");

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) {
      const totp = (data?.totp ?? []).find((f) => f.status === "verified") ?? null;
      setVerifiedFactorId(totp?.id ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (!error) {
        const totp = (data?.totp ?? []).find((f) => f.status === "verified") ?? null;
        setVerifiedFactorId(totp?.id ?? null);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't start setup.");
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function verify() {
    if (!enrolling) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: enrolling.id,
    });
    if (chErr || !ch) {
      setBusy(false);
      toast.error("Couldn't verify — try again.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: ch.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Authenticator app set up.");
    setEnrolling(null);
    void refresh();
  }

  async function cancelEnroll() {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id }).catch(() => {});
    setEnrolling(null);
  }

  async function disable() {
    if (!verifiedFactorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Authenticator app removed.");
    void refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-sage h-5 w-5" aria-hidden /> Two-factor authentication
        </CardTitle>
        <CardDescription>
          Add an authenticator app (TOTP) for an extra layer of security.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : verifiedFactorId ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sage text-sm">An authenticator app is set up on your account.</p>
            <Button variant="outline" onClick={disable} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Remove
            </Button>
          </div>
        ) : enrolling ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Scan this with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrolling.qr}
              alt="Authenticator setup QR code"
              className="h-44 w-44 rounded-lg border bg-white p-2"
            />
            <p className="text-muted-foreground text-xs break-all">
              Or enter this key manually: <span className="font-mono">{enrolling.secret}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                className="h-9 max-w-[120px]"
                aria-label="6-digit code"
              />
              <Button onClick={verify} disabled={busy || code.trim().length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Verify
                &amp; enable
              </Button>
              <Button variant="ghost" onClick={cancelEnroll} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">Not set up yet.</p>
            <Button onClick={startEnroll} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Set up
              authenticator
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
