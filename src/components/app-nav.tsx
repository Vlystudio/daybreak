"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sunrise,
  Sun,
  HeartPulse,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Apple,
  ShoppingBasket,
  Bird,
  Users,
  UserRound,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Item = { href: string; label: string; icon: typeof Sun };

const PRIMARY: Item[] = [
  { href: "/dashboard", label: "Today", icon: Sun },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/onboarding", label: "Plan", icon: ClipboardList },
  { href: "/nest", label: "Nest", icon: Bird },
];

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Your day",
    items: [
      { href: "/dashboard", label: "Today", icon: Sun },
      { href: "/health", label: "Health", icon: HeartPulse },
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/onboarding", label: "Plan", icon: ClipboardList },
      { href: "/coach", label: "Coach", icon: Dumbbell },
    ],
  },
  {
    title: "Nourish",
    items: [
      { href: "/nutrition", label: "Nutrition", icon: Apple },
      { href: "/grocery", label: "Grocery", icon: ShoppingBasket },
    ],
  },
  {
    title: "Play & friends",
    items: [
      { href: "/nest", label: "Nest", icon: Bird },
      { href: "/friends", label: "Friends", icon: Users },
    ],
  },
  {
    title: "You",
    items: [
      { href: "/profile", label: "Profile", icon: UserRound },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {PRIMARY.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" aria-hidden />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu aria-hidden />
              <span className="hidden sm:inline">Menu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="drawer-overlay absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="drawer-panel absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <span className="font-semibold">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="All sections">
              {GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((link) => {
                      const active = isActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                            active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          <link.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-border/60 p-3">
              <form action={signOut}>
                <Button type="submit" variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                  <LogOut className="h-5 w-5" aria-hidden />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom bar */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/60 md:hidden" aria-label="Primary">
        <div className="mx-auto flex max-w-md items-stretch justify-around py-2">
          {PRIMARY.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <link.icon className="h-5 w-5" aria-hidden />
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
