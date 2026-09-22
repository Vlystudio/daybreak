import registry from "../../../config/privacy/processors.json";

export type ProcessorId = (typeof registry.processors)[number]["id"];
export type ProcessorEnvironment = "development" | "test" | "production";

function currentEnvironment(): ProcessorEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

export function processorRecord(id: string) {
  return registry.processors.find((processor) => processor.id === id);
}

export function isProcessorEnabled(
  id: string,
  environment: ProcessorEnvironment = currentEnvironment()
): boolean {
  const record = processorRecord(id);
  if (!record || !record.enabledEnvironments.includes(environment)) return false;
  return environment !== "production" || record.approvalStatus === "approved";
}

export function assertProcessorEnabled(id: string): void {
  if (!isProcessorEnabled(id)) {
    throw new Error(`Processor ${id} is not approved and enabled for this environment.`);
  }
}

export function unapprovedProductionProcessors(): string[] {
  return registry.processors
    .filter(
      (processor) =>
        !processor.enabledEnvironments.includes("production") ||
        processor.approvalStatus !== "approved" ||
        !processor.owner ||
        processor.owner === "unassigned" ||
        !processor.evidence
    )
    .map((processor) => processor.id);
}
