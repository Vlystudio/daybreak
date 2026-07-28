"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, KeyRound, LogOut } from "lucide-react";
import { requestPasswordReset, signOut, signOutAllDevices } from "@/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AccountCard({ email }: { email: string }) {
  const [pending, setPending] = useState(false);

  async function sendReset() {
    if (!email) return;
    setPending(true);
    const result = await requestPasswordReset({ email });
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else toast.success("Password reset link sent to your email.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your sign-in details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="text-muted-foreground h-4 w-4" aria-hidden />
          <span className="text-muted-foreground">Signed in as</span>
          <span className="font-medium">{email}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendReset} disabled={pending}>
            <KeyRound className="h-4 w-4" aria-hidden /> {pending ? "Sending…" : "Change password"}
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </Button>
          </form>
          <form action={signOutAllDevices}>
            <Button type="submit" variant="ghost">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out all devices
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
