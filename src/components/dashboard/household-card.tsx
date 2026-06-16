"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Home, Copy, LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createHousehold, joinHousehold, leaveHousehold } from "@/actions/household";
import type { HouseholdInfo, ScheduleEvent } from "@/lib/types";

export function HouseholdCard({
  household,
  householdEvents,
}: {
  household: HouseholdInfo | null;
  householdEvents: ScheduleEvent[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  if (!household) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-primary" aria-hidden />
            Household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pb-6">
          <p className="text-sm text-muted-foreground">
            Share a schedule with the people you live with — shared events show up on everyone&apos;s
            morning view.
          </p>

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) run(() => createHousehold({ name }), "Household created!");
            }}
          >
            <Label htmlFor="household-name">Start one</Label>
            <div className="flex gap-2">
              <Input
                id="household-name"
                placeholder="The Sunny Side"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
              <Button type="submit" disabled={pending || !name.trim()}>
                Create
              </Button>
            </div>
          </form>

          <Separator />

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) run(() => joinHousehold({ inviteCode: code }), "Welcome home!");
            }}
          >
            <Label htmlFor="household-code">Or join with an invite code</Label>
            <div className="flex gap-2">
              <Input
                id="household-code"
                placeholder="Invite code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={64}
              />
              <Button type="submit" variant="secondary" disabled={pending || !code.trim()}>
                <UserPlus aria-hidden />
                Join
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="h-4 w-4 text-primary" aria-hidden />
          {household.name}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              leaveHousehold,
              household.role === "owner" ? "Household dissolved." : "You left the household."
            )
          }
        >
          <LogOut aria-hidden />
          <span className="sr-only">Leave household</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="flex flex-wrap gap-1.5">
          {household.members.map((m) => (
            <Badge key={m.user_id} variant="sage">
              {m.display_name}
            </Badge>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Shared today</p>
          {householdEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing shared today. Mark an event as “Household” to put it here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {householdEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                    {e.all_day ? "All day" : format(new Date(e.starts_at), "h:mm a")}
                  </span>
                  <span className="truncate">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(household.invite_code);
            toast.success("Invite code copied — share it with your household.");
          }}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Copy invite code
        </button>
      </CardContent>
    </Card>
  );
}
