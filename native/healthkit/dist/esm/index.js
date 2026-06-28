import { registerPlugin } from "@capacitor/core";

// The Daybreak app registers the plugin directly via registerPlugin("HealthKit")
// in src/lib/integrations/apple-health/healthkit.client.ts; this export exists so
// the package has a valid JS entry. The native side is what matters (the pod).
export const HealthKit = registerPlugin("HealthKit");
