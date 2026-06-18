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
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)",
    }),
  CRON_SECRET: z.string().min(16),
  OURA_CLIENT_ID: z.string().min(1).optional(),
  OURA_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  WEATHER_API_KEY: z.string().min(1).optional(),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

// NEXT_PUBLIC_* vars are inlined at build time, so they must be referenced literally.
const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!publicParsed.success) {
  throw new Error(`Invalid public environment variables:\n${formatIssues(publicParsed.error)}`);
}

export const publicEnv = publicParsed.data;

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser. Server secrets must stay on the server.");
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
  google: () => Boolean(serverEnv().GOOGLE_CLIENT_ID && serverEnv().GOOGLE_CLIENT_SECRET),
  openai: () => Boolean(serverEnv().OPENAI_API_KEY),
};
