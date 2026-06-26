import { z } from "zod";

/**
 * Environment variable validation.
 *
 * Server vars are validated lazily (first access on the server) so the client
 * bundle never references them. Public vars are validated eagerly everywhere.
 * The app fails fast with a readable error instead of misbehaving at runtime.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  // VAPID public key for Web Push (safe to expose). Empty disables push.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().default(""),
  // Sentry DSN for error monitoring (safe to expose). Empty disables Sentry.
  NEXT_PUBLIC_SENTRY_DSN: z.string().default(""),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  TOKEN_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, {
    message: "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)",
  }),
  // Optional key rotation: JSON map of `{ keyId: base64Key }` plus the id of the
  // key that should encrypt new data. Unset = use TOKEN_ENCRYPTION_KEY only.
  TOKEN_ENCRYPTION_KEYS: z.string().optional(),
  TOKEN_ENCRYPTION_ACTIVE_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(16),
  OURA_CLIENT_ID: z.string().min(1).optional(),
  OURA_CLIENT_SECRET: z.string().min(1).optional(),
  FITBIT_CLIENT_ID: z.string().min(1).optional(),
  FITBIT_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  WEATHER_API_KEY: z.string().min(1).optional(),
  SPOONACULAR_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  // Verified sender for transactional email, e.g. "Daybreak <hello@yourdomain.com>".
  EMAIL_FROM: z.string().min(1).default("Daybreak <onboarding@resend.dev>"),
  // Web Push (VAPID). Generate with `npx web-push generate-vapid-keys`.
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:hello@daybreak.app"),
  // Dedicated food-image recognition (https://logmeal.com). Falls back to
  // OpenAI vision when unset.
  LOGMEAL_API_KEY: z.string().min(1).optional(),
  // External grocery-deals feed (the "grocerytracker" Supabase project). Read
  // via its anon key + PostgREST; powers store discount prices in the optimizer.
  GROCERYTRACKER_URL: z.string().url().optional(),
  GROCERYTRACKER_ANON_KEY: z.string().min(1).optional(),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

// NEXT_PUBLIC_* vars are inlined at build time, so they must be referenced literally.
const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

if (!publicParsed.success) {
  throw new Error(`Invalid public environment variables:\n${formatIssues(publicParsed.error)}`);
}

export const publicEnv = publicParsed.data;

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() was called in the browser. Server secrets must stay on the server."
    );
  }
  if (!cachedServerEnv) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment variables:\n${formatIssues(parsed.error)}`);
    }
    cachedServerEnv = parsed.data;
  }
  return cachedServerEnv;
}

/** True when the given optional integration is configured. */
export const integrationsAvailable = {
  oura: () => Boolean(serverEnv().OURA_CLIENT_ID && serverEnv().OURA_CLIENT_SECRET),
  fitbit: () => Boolean(serverEnv().FITBIT_CLIENT_ID && serverEnv().FITBIT_CLIENT_SECRET),
  google: () => Boolean(serverEnv().GOOGLE_CLIENT_ID && serverEnv().GOOGLE_CLIENT_SECRET),
  openai: () => Boolean(serverEnv().OPENAI_API_KEY),
  resend: () => Boolean(serverEnv().RESEND_API_KEY),
  push: () => Boolean(serverEnv().VAPID_PRIVATE_KEY && publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  groceryDeals: () =>
    Boolean(serverEnv().GROCERYTRACKER_URL && serverEnv().GROCERYTRACKER_ANON_KEY),
};
