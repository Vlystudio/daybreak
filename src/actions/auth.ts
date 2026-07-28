"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "@/lib/validation";
import { securityRateLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/env";
import {
  ADULT_ATTESTATION_VERSION,
  LEGAL_APPLICATION_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal/versions";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

async function anonymousRateLimitKey(purpose: string, email: string): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const fingerprint = createHash("sha256")
    .update(`${forwarded}\0${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  return `${purpose}:${fingerprint}`;
}

const AUTH_ATTEMPT_LIMIT = { limit: 8, windowSeconds: 600 } as const;
const RESET_ATTEMPT_LIMIT = { limit: 4, windowSeconds: 3600 } as const;

export async function signUpAccount(
  input: z.input<typeof signupSchema>
): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your signup details." };
  }

  const limited = await securityRateLimit(
    await anonymousRateLimitKey("signup", parsed.data.email),
    AUTH_ATTEMPT_LIMIT
  );
  if (!limited.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        adult_attested: true,
        adult_attestation_version: ADULT_ATTESTATION_VERSION,
        accepted_terms_version: TERMS_VERSION,
        acknowledged_privacy_version: PRIVACY_VERSION,
        legal_application_version: LEGAL_APPLICATION_VERSION,
      },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return {
      ok: false,
      error: "We couldn't create the account. Check your details or try again later.",
    };
  }
  return { ok: true };
}

export async function signInAccount(input: z.input<typeof loginSchema>): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid email or password." };

  const limited = await securityRateLimit(
    await anonymousRateLimitKey("login", parsed.data.email),
    AUTH_ATTEMPT_LIMIT
  );
  if (!limited.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Invalid email or password." };
  return { ok: true };
}

const emailSchema = z.object({ email: z.email() });

export async function requestPasswordReset(input: { email: string }): Promise<AuthActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };

  const limited = await securityRateLimit(
    await anonymousRateLimitKey("password-reset", parsed.data.email),
    RESET_ATTEMPT_LIMIT
  );
  if (!limited.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/update-password`,
  });
  if (error) return { ok: false, error: "Password recovery is unavailable. Try again later." };
  return { ok: true };
}

export async function resendSignupConfirmation(input: {
  email: string;
}): Promise<AuthActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };

  const limited = await securityRateLimit(
    await anonymousRateLimitKey("confirmation-resend", parsed.data.email),
    RESET_ATTEMPT_LIMIT
  );
  if (!limited.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email });
  if (error) return { ok: false, error: "Confirmation email is unavailable. Try again later." };
  return { ok: true };
}

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

/** Revoke every refresh token for this account, including the current device. */
export async function signOutAllDevices() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.auth.signOut({ scope: "global" });
  redirect("/login?sessions=revoked");
}
