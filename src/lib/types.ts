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
  steps: number | null;
  active_calories: number | null;
  total_calories: number | null;
  activity_score: number | null;
  spo2_avg: number | null;
  respiratory_rate: number | null;
  stress_high_min: number | null;
  recovery_high_min: number | null;
  resilience_level: string | null;
}

export interface DailySummary {
  date: string;
  summary: string;
  focus: string | null;
  insights: string[];
  recommendations: { title: string; body: string }[];
  generated_at: string;
}

export interface SubjectiveCheckin {
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
  note: string | null;
}

export interface FoodLog {
  id: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: "manual" | "photo";
  created_at: string;
}

export interface BodyMeasurement {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  note: string | null;
}

export type EventColor = "honey" | "sage" | "sky" | "peach";

/** A recipe attached to a planned-meal schedule event, shown when it's opened. */
export interface MealRecipe {
  sourceId: number | null;
  title: string;
  image: string | null;
  sourceUrl: string | null;
  readyInMinutes: number | null;
  servings: number | null;
  ingredients: string[];
  steps: string[];
}

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
  completed_at: string | null;
  plan_type: string | null;
  workout_id: string | null;
  recipe: MealRecipe | null;
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
  daybreak_calendar_id: string | null;
}
