"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const errorMessages: Record<string, string> = {
  denied: "No problem — you can connect anytime from the dashboard.",
  invalid_state: "That connection attempt expired. Please try again.",
  exchange_failed: "We couldn't complete the connection. Please try again.",
};

/** Surfaces OAuth redirect results (?connected= / ?connect_error=) as toasts. */
export function ConnectToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    const connected = searchParams.get("connected");
    const error = searchParams.get("connect_error");
    if (!connected && !error) return;
    shown.current = true;

    if (connected === "oura") toast.success("Oura connected! Your sleep data is on its way.");
    else if (connected === "google") toast.success("Google Calendar connected.");
    else if (error) toast.error(errorMessages[error] ?? "Connection failed.");

    router.replace("/dashboard", { scroll: false });
  }, [searchParams, router]);

  return null;
}
