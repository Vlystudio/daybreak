"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sunrise,
  LayoutDashboard,
  Activity,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  ShoppingBasket,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/health", label: "Health", icon: Activity },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/onboarding", label: "Plan", icon: ClipboardList },
  { href: "/coach", label: "Coach", icon: Dumbbell },
  { href: "/grocery", label: "Grocery", icon: ShoppingBasket },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Top bar */}
      <header className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="bg-sunrise flex h-8 w-8 items-center justify-center rounded-full shadow-soft">
              <Sunrise className="h-4.5 w-4.5 text-[#7a4a12]" aria-hidden />
            </span>
            Daybreak
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith(link.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/60 md:hidden"
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around py-2">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-5 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <link.icon className="h-5 w-5" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
