import "server-only";

import registryJson from "../../../config/privacy/ai-providers.json";

export type RegisteredAiProvider = "openai" | "logmeal";
type Environment = "development" | "test" | "production";

interface ProviderRecord {
  id: string;
  enabledEnvironments: string[];
  emergencyDisabled: boolean;
  approvalStatus: string;
}

const providers = new Map(
  (registryJson.providers as ProviderRecord[]).map((provider) => [provider.id, provider])
);

export function assertAiProviderEnabled(providerId: RegisteredAiProvider): void {
  const provider = providers.get(providerId);
  const environment = (process.env.NODE_ENV ?? "development") as Environment;
  if (
    !provider ||
    provider.emergencyDisabled ||
    !provider.enabledEnvironments.includes(environment)
  ) {
    throw new Error("The requested AI provider is not enabled in this environment.");
  }
  if (environment === "production" && provider.approvalStatus !== "approved") {
    throw new Error("The requested AI provider has not completed production approval.");
  }
}

/** Use the same policy as the API boundary when advertising an AI feature. */
export function isAiProviderEnabled(providerId: RegisteredAiProvider): boolean {
  const provider = providers.get(providerId);
  const environment = (process.env.NODE_ENV ?? "development") as Environment;
  return Boolean(
    provider &&
    !provider.emergencyDisabled &&
    provider.enabledEnvironments.includes(environment) &&
    (environment !== "production" || provider.approvalStatus === "approved")
  );
}

export function registeredAiProviderIds(): string[] {
  return [...providers.keys()].sort();
}
