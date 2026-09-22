type SentryLikeEvent = {
  message?: string;
  user?: unknown;
  request?: unknown;
  extra?: unknown;
  contexts?: unknown;
  breadcrumbs?: unknown;
  exception?: { values?: Array<Record<string, unknown>> };
  [key: string]: unknown;
};

/** Remove content-bearing fields before an event can leave Daybreak. */
export function scrubSentryEvent<T>(event: T): T {
  const input = event as SentryLikeEvent;
  const exception = input.exception?.values
    ? {
        ...input.exception,
        values: input.exception.values.map((value) => ({
          type: typeof value.type === "string" ? value.type.slice(0, 80) : "Error",
          value: "[redacted]",
          stacktrace: value.stacktrace,
          mechanism: value.mechanism,
        })),
      }
    : input.exception;
  return {
    ...input,
    message: input.message ? "[redacted]" : undefined,
    user: undefined,
    request: undefined,
    extra: undefined,
    contexts: undefined,
    breadcrumbs: undefined,
    exception,
  } as T;
}
