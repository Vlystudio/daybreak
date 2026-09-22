"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

const UiOwner = createContext("anonymous");
export const UiPreferencesProvider = UiOwner.Provider;
const values = new Map<string, string>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** In-memory UI choices only; never persists health records or form contents. */
export function useUiPreference<T extends string>(key: string, fallback: T) {
  const owner = useContext(UiOwner);
  const id = `${owner}:${key}`;
  const value = useSyncExternalStore(
    subscribe,
    () => (values.get(id) as T) ?? fallback,
    () => fallback
  );
  const setValue = useCallback(
    (next: T) => {
      values.set(id, next);
      listeners.forEach((listener) => listener());
    },
    [id]
  );
  return [value, setValue] as const;
}
