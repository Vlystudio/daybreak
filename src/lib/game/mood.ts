/** The companion bird's mood, derived from how the user's day is going. */
export type Mood = "happy" | "content" | "sleepy";

export function companionMood(readiness: number | null, checkinMood: number | null): { mood: Mood; label: string } {
  if ((readiness != null && readiness >= 75) || (checkinMood != null && checkinMood >= 4)) {
    return { mood: "happy", label: "feeling great today" };
  }
  if ((readiness != null && readiness < 58) || (checkinMood != null && checkinMood <= 2)) {
    return { mood: "sleepy", label: "taking it easy today" };
  }
  return { mood: "content", label: "doing alright" };
}
