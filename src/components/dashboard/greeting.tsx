import { FadeIn } from "@/components/motion";

function greetingFor(hour: number): string {
  if (hour < 5) return "Up early";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function nowIn(timezone: string): { hour: number; dateLabel: string } {
  const now = new Date();
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(now)
    );
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
    return { hour: Number.isNaN(hour) ? 8 : hour % 24, dateLabel };
  } catch {
    // Unknown timezone string — fall back to server time.
    return {
      hour: now.getHours(),
      dateLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(now),
    };
  }
}

/** Time-of-day greeting, rendered server-side in the user's profile timezone. */
export function Greeting({ name, timezone }: { name: string; timezone: string }) {
  const { hour, dateLabel } = nowIn(timezone);

  return (
    <FadeIn>
      <p className="text-sm font-medium text-muted-foreground">{dateLabel}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {greetingFor(hour)}
        {name ? `, ${name}` : ""}.
      </h1>
    </FadeIn>
  );
}
