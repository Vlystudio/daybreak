import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health provider registry. Declarative metadata (not a class hierarchy) so the
 * Daily Plan, confidence layer, and connections UI can reason about sources
 * uniformly without each provider reimplementing fusion/confidence — that lives
 * once in the source-aware understanding layer (`./understanding`, `./fusion`).
 *
 * Status:
 *  - active:  fully wired today (Oura, Apple Health, Fitbit, manual check-in).
 *  - planned: interface reserved; the Android/Fitbit forward path is the Google
 *             Health API (Health Connect), NOT the legacy Fitbit Web API.
 *  - gated:   requires approval / commercial licensing before it can be enabled
 *             (Garmin). Nothing in Daily Plan depends on a gated provider.
 */

export type ProviderId = "oura" | "apple_health" | "google_health" | "fitbit" | "garmin" | "manual";
export type ProviderStatus = "active" | "planned" | "gated";
export type Platform = "ios" | "android" | "web" | "cross_platform";

export interface HealthProviderInfo {
  id: ProviderId;
  label: string;
  platformSupport: Platform[];
  status: ProviderStatus;
  /** Signals this provider can contribute once fully wired (documentation only). */
  signals: string[];
  note?: string;
}

export const HEALTH_PROVIDERS: HealthProviderInfo[] = [
  {
    id: "oura",
    label: "Oura",
    platformSupport: ["cross_platform"],
    status: "active",
    signals: ["sleep", "readiness", "hrv", "resting_heart_rate", "temperature", "spo2", "steps"],
  },
  {
    id: "apple_health",
    label: "Apple Health",
    platformSupport: ["ios"],
    status: "active",
    signals: [
      "sleep",
      "hrv",
      "resting_heart_rate",
      "steps",
      "active_minutes",
      "workouts",
      "respiratory_rate",
      "spo2",
    ],
  },
  {
    id: "fitbit",
    label: "Fitbit",
    platformSupport: ["android", "ios", "web"],
    status: "active",
    signals: ["sleep", "hrv", "resting_heart_rate", "steps", "active_minutes"],
    note: "Fitbit is migrating under the Google Health API; treat as the legacy entry into the google_health path.",
  },
  {
    id: "google_health",
    label: "Google Health",
    platformSupport: ["android"],
    status: "planned",
    signals: [
      "sleep",
      "steps",
      "active_minutes",
      "resting_heart_rate",
      "hrv",
      "spo2",
      "respiratory_rate",
      "calories",
    ],
    note: "Android/Fitbit forward path via Google Health / Health Connect. Interface reserved; not yet wired — TODO when API config lands.",
  },
  {
    id: "garmin",
    label: "Garmin",
    platformSupport: ["cross_platform"],
    status: "gated",
    signals: [
      "steps",
      "sleep",
      "calories",
      "heart_rate",
      "stress",
      "spo2",
      "body_battery",
      "respiration",
    ],
    note: "Garmin Health API requires approval and may need a commercial license. Disabled unless explicitly configured; Daily Plan never depends on it.",
  },
  {
    id: "manual",
    label: "Manual check-in",
    platformSupport: ["cross_platform"],
    status: "active",
    signals: ["manual_energy", "manual_mood", "manual_stress", "manual_soreness"],
  },
];

const BY_ID = new Map(HEALTH_PROVIDERS.map((p) => [p.id, p]));

export function providerLabel(id: string): string {
  return BY_ID.get(id as ProviderId)?.label ?? id;
}

export function providerInfo(id: string): HealthProviderInfo | undefined {
  return BY_ID.get(id as ProviderId);
}

/** A provider can only contribute data when it is active (not planned/gated). */
export function isProviderEnabled(id: string): boolean {
  return BY_ID.get(id as ProviderId)?.status === "active";
}

/**
 * Which providers a user actually has connected right now. Mirrors the detection
 * the understanding layer uses (OAuth connections for Oura/Fitbit, an Apple
 * Health import/sample for Apple). Manual is always available.
 */
export async function getConnectedProviders(userId: string): Promise<ProviderId[]> {
  const admin = createAdminClient();
  const [{ data: conns }, { data: imports }, { data: samples }] = await Promise.all([
    admin
      .from("oauth_connections")
      .select("provider")
      .eq("user_id", userId)
      .returns<{ provider: string }[]>(),
    admin
      .from("apple_health_imports")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .returns<{ id: string }[]>(),
    admin
      .from("health_daily_samples")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .returns<{ user_id: string }[]>(),
  ]);
  const providers = new Set((conns ?? []).map((c) => c.provider));
  const connected: ProviderId[] = [];
  if (providers.has("oura")) connected.push("oura");
  if (providers.has("fitbit")) connected.push("fitbit");
  if ((imports ?? []).length > 0 || (samples ?? []).length > 0) connected.push("apple_health");
  connected.push("manual");
  return connected;
}
