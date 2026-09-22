export interface AssuranceLevels {
  currentLevel: string | null;
  nextLevel: string | null;
}

export function requiresMfaChallenge(levels: AssuranceLevels | null | undefined): boolean {
  return levels?.nextLevel === "aal2" && levels.currentLevel !== "aal2";
}

export function safePostAuthPath(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }
  if (candidate === "/login/mfa" || candidate.startsWith("/login/mfa?")) {
    return "/dashboard";
  }
  return candidate;
}
