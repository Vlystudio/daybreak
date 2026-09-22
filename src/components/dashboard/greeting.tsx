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
export function Greeting({
  name,
  timezone,
  avatarUrl,
}: {
  name: string;
  timezone: string;
  avatarUrl?: string | null;
}) {
  const { hour, dateLabel } = nowIn(timezone);

  return (
    <FadeIn>
      <div className="flex items-center gap-3">
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="shadow-soft ring-card h-12 w-12 shrink-0 rounded-full object-cover ring-2"
          />
        )}
        <div>
          <p className="text-muted-foreground text-xs font-medium">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greetingFor(hour)}
            {name ? `, ${name}` : ""}.
          </h1>
        </div>
      </div>
    </FadeIn>
  );
}
