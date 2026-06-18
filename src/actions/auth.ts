"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out on the SERVER so the httpOnly auth cookies actually get cleared.
 * A browser-side signOut() can't delete httpOnly cookies, so the session would
 * survive — this is the reliable path.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
