import Link from "next/link";
import { Sunrise, HeartPulse, CalendarDays, Sparkles, ShieldCheck, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Moon,
    title: "Sleep & readiness",
    body: "Your Oura ring data, distilled into a calm picture of how recovered you are today.",
  },
  {
    icon: HeartPulse,
    title: "HRV trends",
    body: "Watch your nervous system find its rhythm with gentle week-over-week trends.",
  },
  {
    icon: Sparkles,
    title: "AI morning briefing",
    body: "A warm, personal note each morning on how to make the most of your energy.",
  },
  {
    icon: CalendarDays,
    title: "Your day, in one place",
    body: "Google Calendar sync plus a beautiful manual planner — including a shared household view.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-sunrise-soft flex-1">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="bg-sunrise flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
              <Sunrise className="h-5 w-5 text-[#7a4a12]" aria-hidden />
            </span>
            Daybreak
          </div>
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Good morning.
            <br />
            <span className="text-primary">Here&apos;s how you&apos;re doing today.</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Daybreak gathers your sleep, readiness, HRV, weather, and schedule into one calm
            morning briefing — so you can shape your day around how you actually feel.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login?mode=signup">Start your mornings here</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-6 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-sage" aria-hidden />
            Your health data stays yours — encrypted, row-level secured, never sold.
          </p>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="glass border-none">
              <CardContent className="p-6">
                <f.icon className="h-6 w-6 text-primary" aria-hidden />
                <h2 className="mt-3 font-semibold">{f.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
