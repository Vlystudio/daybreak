"use client";

import { useRef, useState, type MouseEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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
  LogOut,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import {
  NEST_ENABLED,
  SOCIAL_FEATURES_ENABLED,
  GROCERY_ENABLED,
  COACH_ENABLED,
  NUTRITION_ENABLED,
} from "@/lib/features";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { rememberPageScroll } from "@/components/app-experience";
import { feedback } from "@/lib/ui/haptics";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="nav-pending" role="status">
      <span className="sr-only">Opening page</span>
    </span>
  ) : null;
}

type Item = { href: string; label: string; icon: typeof Sun };

const PRIMARY: Item[] = [
  { href: "/dashboard", label: "Today", icon: Sun },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/health", label: "Health", icon: HeartPulse },
  ...(NEST_ENABLED ? [{ href: "/nest", label: "Nest", icon: Bird }] : []),
];

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Your day",
    items: [
      { href: "/dashboard", label: "Today", icon: Sun },
      { href: "/health", label: "Health", icon: HeartPulse },
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/onboarding", label: "Plan preferences", icon: ClipboardList },
      ...(COACH_ENABLED ? [{ href: "/coach", label: "Coach", icon: Dumbbell }] : []),
    ],
  },
  ...(NUTRITION_ENABLED || GROCERY_ENABLED
    ? [
        {
          title: "Nourish",
          items: [
            ...(NUTRITION_ENABLED ? [{ href: "/nutrition", label: "Nutrition", icon: Apple }] : []),
            ...(GROCERY_ENABLED
              ? [{ href: "/grocery", label: "Grocery", icon: ShoppingBasket }]
              : []),
          ],
        },
      ]
    : []),
  ...(NEST_ENABLED || SOCIAL_FEATURES_ENABLED
    ? [
        {
          title: "Play & friends",
          items: [
            ...(NEST_ENABLED ? [{ href: "/nest", label: "Nest", icon: Bird }] : []),
            ...(SOCIAL_FEATURES_ENABLED
              ? [{ href: "/friends", label: "Friends", icon: Users }]
              : []),
          ],
        },
      ]
    : []),
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
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const firstMenuLink = useRef<HTMLAnchorElement | null>(null);

  function openMenu(event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    setOpen(true);
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Top bar */}
      <header className="glass border-border/60 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="bg-sunrise shadow-soft flex h-8 w-8 items-center justify-center rounded-full">
              <Sunrise className="h-4.5 w-4.5 text-[#7a4a12]" aria-hidden />
            </span>
            Daybreak
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {PRIMARY.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => {
                  rememberPageScroll(pathname);
                  void feedback();
                }}
                scroll={false}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" aria-hidden />
                {link.label}
                <PendingNavigation />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={openMenu} aria-label="Open menu">
              <Menu aria-hidden />
              <span className="hidden sm:inline">Menu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Radix traps focus, handles Escape and restores focus to the opener. */}
      <DialogContent
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          firstMenuLink.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
        className="top-0 right-0 left-auto flex h-dvh w-[82%] max-w-sm translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] [&>button]:top-[calc(env(safe-area-inset-top)+0.5rem)] [&>button]:flex [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:items-center [&>button]:justify-center"
      >
        <div className="border-border/60 border-b px-5 py-5">
          <DialogTitle className="font-semibold">Menu</DialogTitle>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="All sections">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-muted-foreground px-3 pb-1.5 text-xs font-semibold tracking-wide uppercase">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      ref={link.href === "/dashboard" ? firstMenuLink : undefined}
                      href={link.href}
                      onClick={() => {
                        rememberPageScroll(pathname);
                        feedback();
                        setOpen(false);
                      }}
                      scroll={false}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <link.icon
                        className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
                        aria-hidden
                      />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-border/60 border-t p-3">
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="text-muted-foreground w-full justify-start gap-3"
            >
              <LogOut className="h-5 w-5" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </DialogContent>

      {/* Mobile bottom bar */}
      <nav
        className="nav-surface border-border/70 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-stretch gap-1 px-3 py-2">
          {PRIMARY.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                scroll={false}
                onClick={() => {
                  rememberPageScroll(pathname);
                  void feedback();
                }}
                className={cn(
                  "nav-link transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    aria-hidden
                    className="nav-indicator"
                    layoutId="primary-navigation"
                    transition={
                      reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }
                    }
                  />
                )}
                <link.icon className="h-5 w-5" aria-hidden />
                <span>{link.label}</span>
                <PendingNavigation />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={openMenu}
            className="nav-link text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
            More
          </button>
        </div>
      </nav>
    </Dialog>
  );
}
