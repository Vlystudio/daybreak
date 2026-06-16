import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/env";

/** Browser Supabase client. Only ever holds the anon key; RLS enforces access. */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
