"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { WifiOff } from "lucide-react";
import { UiPreferencesProvider } from "@/components/ui-preferences";

function subscribeNetwork(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
const scrollPositions = new Map<string, number>();
export function rememberPageScroll(path: string) {
  scrollPositions.set(path, window.scrollY);
}

export function AppExperience({ children, userId }: { children: ReactNode; userId: string }) {
  const pathname = usePathname();
  const historyNavigation = useRef(false);
  const online = useSyncExternalStore(
    subscribeNetwork,
    () => navigator.onLine,
    () => true
  );
  useEffect(() => {
    const onHistory = () => {
      historyNavigation.current = true;
    };
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, []);
  useEffect(() => {
    // Back/forward already has browser/Next scroll restoration.
    if (historyNavigation.current) {
      historyNavigation.current = false;
      return;
    }
    const main = document.getElementById("main-content");
    const saved = scrollPositions.get(pathname) ?? 0;
    if (!main || window.location.hash) return;
    let frame = 0;
    const restore = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "instant" }));
    };
    const observer = new ResizeObserver(restore);
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    observer.observe(main);
    restore();
    const timeout = window.setTimeout(stop, 1500);
    window.addEventListener("pointerdown", stop, { once: true, passive: true });
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("keydown", stop, { once: true });
    return () => {
      stop();
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pathname]);
  return (
    <UiPreferencesProvider value={userId}>
      <MotionConfig
        reducedMotion="user"
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        {!online && (
          <div role="status" className="offline-banner">
            <WifiOff aria-hidden className="h-4 w-4 shrink-0" />
            You’re offline. Reconnect before saving changes or refreshing your data.
          </div>
        )}
        {children}
      </MotionConfig>
    </UiPreferencesProvider>
  );
}
