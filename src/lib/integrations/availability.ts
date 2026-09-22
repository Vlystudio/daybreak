import "server-only";

import { integrationsAvailable } from "@/env";
import { isProcessorEnabled } from "@/lib/privacy/processors";
import { isAiProviderEnabled } from "@/lib/integrations/ai-provider-registry";

/** Credentials alone do not make a production integration usable. */
export const availableIntegrations = {
  oura: () => isProcessorEnabled("oura") && integrationsAvailable.oura(),
  google: () => isProcessorEnabled("google") && integrationsAvailable.google(),
  fitbit: () => isProcessorEnabled("fitbit") && integrationsAvailable.fitbit(),
  openai: () => isAiProviderEnabled("openai") && integrationsAvailable.openai(),
  resend: () => isProcessorEnabled("resend") && integrationsAvailable.resend(),
  push: () => isProcessorEnabled("web_push") && integrationsAvailable.push(),
  weather: () =>
    isProcessorEnabled("open_meteo") ||
    (isProcessorEnabled("weatherapi") && Boolean(process.env.WEATHER_API_KEY)),
  citySearch: () => isProcessorEnabled("open_meteo"),
};
