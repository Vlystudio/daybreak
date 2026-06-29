/**
 * Health provider registry. Pure, declarative metadata (no class hierarchy, no
 * DB access) so the Daily Plan, confidence layer, connections UI, and tests can
 * all reason about sources uniformly. Source fusion/confidence lives ONCE in the
 * understanding layer (`./understanding`, `./fusion`) — providers never
 * reimplement it.
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

/** The state of a provider for a given user, shown in the connections UI. */
export type ProviderState = "Connected" | "Available" | "Planned" | "Gated" | "Not configured";

export interface HealthProviderInfo {
  id: ProviderId;
  label: string;
  platformSupport: Platform[];
  status: ProviderStatus;
  /** Short description for the connections UI. */
  description: string;
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
    description: "Sleep, readiness & HRV",
    signals: ["sleep", "readiness", "hrv", "resting_heart_rate", "temperature", "spo2", "steps"],
  },
  {
    id: "apple_health",
    label: "Apple Health",
    platformSupport: ["ios"],
    status: "active",
    description: "Sleep, HRV, heart rate & activity",
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
    description: "Sleep, heart rate & activity",
    signals: ["sleep", "hrv", "resting_heart_rate", "steps", "active_minutes"],
    note: "Fitbit is migrating under the Google Health API; treat as the legacy entry into the google_health path.",
  },
  {
    id: "google_health",
    label: "Google Health",
    platformSupport: ["android"],
    status: "planned",
    description: "Android sleep, steps & heart rate",
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
    description: "Sleep, body battery & stress",
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
    description: "How you say you feel — energy, mood, stress",
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
 * Resolve a provider's display state from its status plus what we know about the
 * user. Pure — the caller supplies `connected` (a real connection/import exists)
 * and `configured` (server credentials exist for it). Never invents a working
 * auth flow for a provider that isn't configured.
 */
export function providerState(
  info: HealthProviderInfo,
  opts: { connected?: boolean; configured?: boolean } = {}
): ProviderState {
  if (info.status === "gated") return "Gated";
  if (info.status === "planned") return opts.configured ? "Available" : "Planned";
  // active:
  if (opts.connected) return "Connected";
  return opts.configured === false ? "Not configured" : "Available";
}
