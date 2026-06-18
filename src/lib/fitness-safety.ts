/**
 * Hard-coded fitness safety guardrails, applied around every OpenAI call.
 * Pure logic — safe to import on client or server.
 */

export const FITNESS_DISCLAIMER =
  "This is general fitness guidance, not medical advice. Stop and seek medical care if anything feels wrong.";

export const SAFETY_SYSTEM_RULES = `Safety rules you must always follow:
- You are NOT a doctor. Never diagnose. Frame everything as general fitness guidance, not medical care.
- Never advise training through chest pain, dizziness, fainting, severe shortness of breath, or sharp/stabbing pain. If such symptoms are mentioned, advise rest and seeing a medical professional.
- Respect every stated injury/limitation; do not load or strain an injured area.
- For beginners, avoid max-effort or one-rep-max lifts; favor moderate, controlled work with good form.
- Never prescribe extreme calorie deficits or crash dieting.
- Progress gradually: increase reps before load, don't spike weekly volume, and deload when recovery is poor.`;

const RED_FLAGS: { pattern: RegExp; label: string }[] = [
  { pattern: /chest (pain|tightness|pressure)/i, label: "chest pain" },
  { pattern: /short(ness)? of breath|can'?t breathe|trouble breathing/i, label: "shortness of breath" },
  { pattern: /dizz|light[- ]?headed|faint|passed out|black(ing)? out/i, label: "dizziness or fainting" },
  { pattern: /sharp pain|stabbing pain/i, label: "sharp pain" },
  { pattern: /numbness|tingling.*(arm|leg|hand|foot)/i, label: "numbness or tingling" },
  { pattern: /heart (racing|palpitation)|palpitations|irregular heart/i, label: "heart palpitations" },
];

/** Returns the red-flag symptom labels found in free text (empty if none). */
export function detectRedFlags(text: string | null | undefined): string[] {
  if (!text) return [];
  return RED_FLAGS.filter((r) => r.pattern.test(text)).map((r) => r.label);
}

/** Guidance shown instead of a workout when dangerous symptoms are detected. */
export function redFlagGuidance(flags: string[]): string {
  return `What you described (${flags.join(
    ", "
  )}) can be a sign of a medical issue. Please don't exercise right now — rest and contact a healthcare professional, or emergency services if it's severe. ${FITNESS_DISCLAIMER}`;
}
