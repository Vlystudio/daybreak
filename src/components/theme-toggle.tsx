"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The current theme lives on <html class="dark">, set before hydration by an
 * inline script. We read it as an external store so the toggle stays in sync
 * without a state-syncing effect, and SSR safely renders the light icon.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function setDark(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark(!isDark())}
      aria-label="Toggle dark mode"
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
