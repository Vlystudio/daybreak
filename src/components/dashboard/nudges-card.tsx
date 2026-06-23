"use client";

import { useTransition } from "react";
import { Hand } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markNudgesRead } from "@/actions/nudges";

const PRESET: Record<"cheer" | "reminder", string> = {
  cheer: "is cheering you on 💪",
  reminder: "nudged you to check in 👋",
};

export function NudgesCard({
  nudges,
}: {
  nudges: { id: string; fromName: string; kind: "cheer" | "reminder"; message: string | null }[];
}) {
  const [pending, startTransition] = useTransition();
  if (nudges.length === 0) return null;

  function clear() {
    startTransition(async () => {
      const result = await markNudgesRead();
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card className="border-none bg-honey-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#9a6b1f]">
          <Hand className="h-4 w-4" aria-hidden />
          Nudges from friends
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={clear} disabled={pending} className="text-[#9a6b1f]">
          {pending ? "Clearing…" : "Clear"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {nudges.map((n) => (
          <p key={n.id} className="text-sm text-[#5a3d1a]">
            <span className="font-semibold">{n.fromName}</span>{" "}
            {n.message ? n.message : PRESET[n.kind]}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
