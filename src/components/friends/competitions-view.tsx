"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, Plus, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createCompetition, joinCompetition, declineCompetition } from "@/actions/competitions";
import type { CompetitionCard, CompetitionMetric } from "@/lib/competitions";

const METRICS: { value: CompetitionMetric; label: string; unit: string }[] = [
  { value: "steps", label: "Steps", unit: "steps" },
  { value: "active_calories", label: "Active calories", unit: "cal" },
  { value: "habits", label: "Habits completed", unit: "done" },
  { value: "protein", label: "Protein", unit: "g" },
];
const LENGTHS = [7, 14, 30];
const metricMeta = (m: CompetitionMetric) => METRICS.find((x) => x.value === m) ?? METRICS[0];

export function CompetitionsView({
  competitions,
  friends,
}: {
  competitions: CompetitionCard[];
  friends: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<CompetitionMetric>("steps");
  const [lengthDays, setLengthDays] = useState(7);
  const [picked, setPicked] = useState<string[]>([]);

  function create() {
    if (!title.trim() || picked.length === 0) {
      toast.error("Add a name and pick at least one friend.");
      return;
    }
    startTransition(async () => {
      const res = await createCompetition({ title: title.trim(), metric, lengthDays, friendIds: picked });
      if (res.ok) {
        toast.success("Challenge started!");
        setOpen(false);
        setTitle("");
        setPicked([]);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
      else toast.error(r.error ?? "Something went wrong.");
    });
  }

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-honey" aria-hidden /> Challenges
        </CardTitle>
        {friends.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
            <Plus className="h-4 w-4" aria-hidden /> New
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {friends.length === 0 && competitions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add a friend first, then challenge them to a steps or active-calorie race.
          </p>
        )}

        {open && (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-title">Challenge name</Label>
              <Input
                id="comp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekend step war"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comp-metric">Compete on</Label>
                <select
                  id="comp-metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as CompetitionMetric)}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comp-length">Length</Label>
                <select
                  id="comp-length"
                  value={lengthDays}
                  onChange={(e) => setLengthDays(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                >
                  {LENGTHS.map((l) => (
                    <option key={l} value={l}>
                      {l} days
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Invite</Label>
              <div className="flex flex-wrap gap-1.5">
                {friends.map((f) => (
                  <button
                    key={f.userId}
                    type="button"
                    onClick={() => togglePick(f.userId)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      picked.includes(f.userId)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={create} disabled={pending}>
              Start challenge
            </Button>
          </div>
        )}

        {competitions.length > 0 && (
          <ul className="space-y-3">
            {competitions.map((c) => {
              const meta = metricMeta(c.metric);
              return (
                <li key={c.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {meta.label} · {c.daysLeft > 0 ? `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left` : "ended"}
                      </p>
                    </div>
                    {c.myStatus === "invited" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => act(() => joinCompetition(c.id))} disabled={pending}>
                          Join
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => act(() => declineCompetition(c.id))}
                          disabled={pending}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                  <ol className="mt-2 space-y-1">
                    {c.standings.map((s, i) => (
                      <li
                        key={s.userId}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2 py-1 text-sm",
                          s.isMe && "bg-muted"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>
                          {i === 0 && s.joined && <Crown className="h-3.5 w-3.5 text-honey" aria-hidden />}
                          <span className={cn(s.isMe && "font-medium")}>{s.isMe ? "You" : s.name}</span>
                          {!s.joined && <span className="text-xs text-muted-foreground">(invited)</span>}
                        </span>
                        <span className="tabular-nums">
                          {s.joined ? `${s.score.toLocaleString()} ${meta.unit}` : "—"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
