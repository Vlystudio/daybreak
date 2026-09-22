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
}: {
  onboardingCompleted: boolean;
  hasCity: boolean;
}) {
  const steps: Step[] = [
    {
      label: "Set your daily rhythm",
      done: onboardingCompleted,
      href: "/onboarding",
      cta: "Start",
    },
    { label: "Set your city for weather", done: hasCity, href: "/settings", cta: "Add" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully set up — hide it

  return (
    <Card className="border-primary/30 bg-honey-soft/40">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Make it your day</CardTitle>
        <p className="text-muted-foreground text-sm">
          Optional setup for better suggestions. Health and calendar connections are in Settings.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg p-2">
            {s.done ? (
              <CheckCircle2 className="text-primary h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <Circle className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
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
