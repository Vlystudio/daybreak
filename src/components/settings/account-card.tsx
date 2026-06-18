"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, KeyRound, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AccountCard({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function sendReset() {
    if (!email) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/update-password`,
    });
    setPending(false);
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email.");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your sign-in details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Signed in as</span>
          <span className="font-medium">{email}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendReset} disabled={pending}>
            <KeyRound className="h-4 w-4" aria-hidden /> {pending ? "Sending…" : "Change password"}
          </Button>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
