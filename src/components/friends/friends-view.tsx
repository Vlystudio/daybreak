"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Check, X, Trash2, Footprints, Target, CalendarDays, Hand } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FITNESS_GOALS } from "@/lib/planning";
import { sendFriendRequest, respondToRequest, removeFriend, saveFriendSettings } from "@/actions/friends";
import { sendNudge } from "@/actions/nudges";
import type { FriendsData, FriendSettings } from "@/lib/friends";

const goalLabel = (v: string | null) => FITNESS_GOALS.find((g) => g.value === v)?.label ?? v;

const SHARE_ROWS: { key: keyof FriendSettings; label: string; hint: string }[] = [
  { key: "share_activity", label: "Physical activity", hint: "Steps and activity score" },
  { key: "share_calendar", label: "Calendar", hint: "How busy your day is" },
  { key: "share_goals", label: "Goals", hint: "Your fitness goal" },
];

export function FriendsView({ data }: { data: FriendsData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [share, setShare] = useState<FriendSettings>(data.settings);

  function invite() {
    const e = email.trim();
    if (!e) return;
    startTransition(async () => {
      const res = await sendFriendRequest(e);
      if (res.ok) {
        toast.success("Request sent.");
        setEmail("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function respond(id: string, accept: boolean) {
    startTransition(async () => {
      const res = await respondToRequest(id, accept);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeFriend(id);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function cheer(userId: string, name: string) {
    startTransition(async () => {
      const res = await sendNudge({ toUserId: userId, kind: "cheer" });
      if (res.ok) toast.success(`Cheered ${name} on 💪`);
      else toast.error(res.error);
    });
  }

  function toggleShare(key: keyof FriendSettings, value: boolean) {
    const next = { ...share, [key]: value };
    setShare(next);
    startTransition(async () => {
      const res = await saveFriendSettings({
        shareActivity: next.share_activity,
        shareCalendar: next.share_calendar,
        shareGoals: next.share_goals,
      });
      if (!res.ok) {
        toast.error(res.error);
        setShare(share);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add a friend</CardTitle>
          <CardDescription>Invite by the email they use for Daybreak.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  invite();
                }
              }}
              placeholder="friend@example.com"
            />
            <Button onClick={invite} disabled={pending || !email.trim()}>
              <UserPlus className="h-4 w-4" aria-hidden /> Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {data.incoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Friend requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.incoming.map((r) => (
                <li key={r.friendshipId} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.name}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => respond(r.friendshipId, true)} disabled={pending}>
                      <Check className="h-4 w-4" aria-hidden /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => respond(r.friendshipId, false)}
                      disabled={pending}
                      aria-label="Decline"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What friends can see</CardTitle>
          <CardDescription>You share nothing until you turn it on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SHARE_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <div>
                <Label className="font-medium">{row.label}</Label>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
              </div>
              <Switch
                checked={share[row.key]}
                disabled={pending}
                onCheckedChange={(v) => toggleShare(row.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Friends</CardTitle>
        </CardHeader>
        <CardContent>
          {data.friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends yet — invite someone above.</p>
          ) : (
            <ul className="space-y-3">
              {data.friends.map((f) => (
                <li key={f.friendshipId} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{f.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => cheer(f.userId, f.name)}
                      >
                        <Hand className="h-4 w-4 text-honey" aria-hidden />
                        Cheer
                      </Button>
                      <button
                        type="button"
                        onClick={() => remove(f.friendshipId)}
                        aria-label={`Remove ${f.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {f.shares.activity && (
                      <span className="inline-flex items-center gap-1">
                        <Footprints className="h-3.5 w-3.5" aria-hidden />
                        {f.stepsAvg != null ? `${f.stepsAvg.toLocaleString()} steps/day` : "—"}
                        {f.activityScore != null ? ` · score ${f.activityScore}` : ""}
                      </span>
                    )}
                    {f.shares.goals && f.goal && (
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" aria-hidden /> {goalLabel(f.goal)}
                      </span>
                    )}
                    {f.shares.calendar && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {f.eventsToday ?? 0} today
                      </span>
                    )}
                    {!f.shares.activity && !f.shares.calendar && !f.shares.goals && (
                      <span className="text-xs">Not sharing anything yet</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data.outgoing.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pending invites</p>
              <ul className="space-y-1.5 text-sm">
                {data.outgoing.map((r) => (
                  <li key={r.friendshipId} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{r.name} · invited</span>
                    <button
                      type="button"
                      onClick={() => remove(r.friendshipId)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      disabled={pending}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
