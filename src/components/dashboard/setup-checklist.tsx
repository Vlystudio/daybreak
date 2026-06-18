import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Step {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

export function SetupChecklist({
  onboardingCompleted,
  hasCity,
  hasOura,
  hasGoogle,
}: {
  onboardingCompleted: boolean;
  hasCity: boolean;
  hasOura: boolean;
  hasGoogle: boolean;
}) {
  const steps: Step[] = [
    { label: "Build your plan profile", done: onboardingCompleted, href: "/onboarding", cta: "Start" },
    { label: "Set your city for weather", done: hasCity, href: "/settings", cta: "Add" },
    { label: "Connect Oura", done: hasOura, href: "/settings", cta: "Connect" },
    { label: "Connect Google Calendar", done: hasGoogle, href: "/settings", cta: "Connect" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully set up — hide it

  return (
    <Card className="border-primary/30 bg-honey-soft/40">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Finish setting up Daybreak</CardTitle>
        <p className="text-sm text-muted-foreground">
          {doneCount} of {steps.length} done — a few steps to unlock everything.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg p-2">
            {s.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>
              {s.label}
            </span>
            {!s.done && (
              <Button asChild size="sm" variant="outline">
                <Link href={s.href}>
                  {s.cta}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
