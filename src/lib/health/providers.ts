/**
 * Health provider registry. Pure, declarative metadata (no class hierarchy, no
 * DB access) so the Daily Plan, confidence layer, connections UI, and tests can
 * all reason about sources uniformly. Source fusion/confidence lives ONCE in the
 * understanding layer (`./understanding`, `./fusion`) — providers never
 * reimplement it.
 *
 * Only supported V1 sources belong here. Future integrations must not enter the
 * product registry until their code, privacy, commercial, and release reviews
 * are complete.
 */

export type ProviderId = "oura" | "apple_health" | "fitbit" | "manual";
export type ProviderStatus = "active";
export type Platform = "ios" | "android" | "web" | "cross_platform";

/** The state of a provider for a given user, shown in the connections UI. */
export type ProviderState = "Connected" | "Available" | "Not configured";

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

/** Registered V1 providers can contribute data. */
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
  if (opts.connected) return "Connected";
  return opts.configured === false ? "Not configured" : "Available";
}
