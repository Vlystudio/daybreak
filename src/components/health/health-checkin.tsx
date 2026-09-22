"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Sparkles, CalendarPlus, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  startCheckin,
  replyCheckin,
  scheduleCheckinAction,
  type CheckinMessage,
} from "@/actions/health";

type CheckinAction = NonNullable<CheckinMessage["action"]>;

export function HealthCheckin({
  initial,
  hasData,
}: {
  initial: { id: string; messages: CheckinMessage[] } | null;
  hasData: boolean;
}) {
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [messages, setMessages] = useState<CheckinMessage[]>(initial?.messages ?? []);
  const [input, setInput] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  function addToSchedule(index: number, action: CheckinAction) {
    startTransition(async () => {
      const res = await scheduleCheckinAction(action);
      if (res.ok) {
        setAdded((s) => new Set(s).add(index));
        toast.success("Added to your schedule.");
      } else {
        toast.error(res.error);
      }
    });
  }

  function start() {
    startTransition(async () => {
      const res = await startCheckin();
      if (res.ok) {
        setId(res.id);
        setMessages(res.messages);
      } else {
        toast.error(res.error);
      }
    });
  }

  function send() {
    const text = input.trim();
    if (!text || !id) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, at: new Date().toISOString() }]);
    startTransition(async () => {
      const res = await replyCheckin(id, text);
      if (res.ok) setMessages(res.messages);
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="text-primary h-4 w-4" aria-hidden /> Check-in
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>
              A quick back-and-forth: I&apos;ll look at your recent trends, ask about whatever
              stands out, and we&apos;ll work out what&apos;s behind it together.
            </p>
            <Button onClick={start} disabled={pending || !hasData}>
              <Sparkles className="h-4 w-4" aria-hidden />{" "}
              {pending ? "Starting…" : "Start a check-in"}
            </Button>
            {!hasData && (
              <p className="text-xs">
                Connect a supported health source and sync a few days first.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div key={i} className="space-y-1.5">
                  <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                  {m.role === "assistant" && m.action && (
                    <div className="flex justify-start">
                      {added.has(i) ? (
                        <span className="text-sage inline-flex items-center gap-1 text-xs font-medium">
                          <Check className="h-3.5 w-3.5" aria-hidden /> Added to your schedule
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => addToSchedule(i, m.action!)}
                        >
                          <CalendarPlus className="h-4 w-4" aria-hidden /> Add &ldquo;
                          {m.action.title}&rdquo; to my schedule
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="bg-muted text-muted-foreground rounded-2xl px-3 py-2 text-sm">
                    …
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your answer…"
                maxLength={1000}
                disabled={pending}
              />
              <Button onClick={send} disabled={pending || !input.trim()} aria-label="Send">
                <Send className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
