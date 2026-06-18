"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startCheckin, replyCheckin, type CheckinMessage } from "@/actions/health";

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
  const [pending, startTransition] = useTransition();

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
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden /> Check-in
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              A quick back-and-forth: I&apos;ll look at your recent trends, ask about whatever stands out,
              and we&apos;ll work out what&apos;s behind it together.
            </p>
            <Button onClick={start} disabled={pending || !hasData}>
              <Sparkles className="h-4 w-4" aria-hidden /> {pending ? "Starting…" : "Start a check-in"}
            </Button>
            {!hasData && <p className="text-xs">Connect Oura and sync a few nights of data first.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">…</div>
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
