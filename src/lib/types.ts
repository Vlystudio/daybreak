/** Shared row types matching the Supabase schema. */

export interface Profile {
  id: string;
  display_name: string;
  timezone: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
}

export interface HealthMetric {
  date: string;
  readiness_score: number | null;
  sleep_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  sleep_duration_min: number | null;
  sleep_efficiency: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  light_sleep_min: number | null;
  activity_balance: number | null;
  body_temperature_delta: number | null;
}

export interface DailySummary {
  date: string;
  summary: string;
  focus: string | null;
  insights: string[];
  recommendations: { title: string; body: string }[];
  generated_at: string;
}

export type EventColor = "honey" | "sage" | "sky" | "peach";

export interface ScheduleEvent {
  id: string;
  user_id: string;
  household_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  source: "manual" | "google" | "plan";
  color: EventColor | null;
}

export interface Connection {
  provider: "oura" | "google";
  connected_at: string;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  invite_code: string;
  role: "owner" | "member";
  members: { user_id: string; display_name: string }[];
}

export interface CalendarSyncSettings {
  sync_enabled: boolean;
  google_calendar_id: string;
  last_synced_at: string | null;
}
