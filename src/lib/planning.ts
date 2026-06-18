/** Option vocabularies for onboarding / planning, shared by the form, the
 *  server action, and (later) the AI prompts so everything stays consistent. */

export type Option<T extends string> = { value: T; label: string };

export const WORK_TYPES = [
  { value: "office", label: "Office / desk work" },
  { value: "physical", label: "Physical / active labor" },
  { value: "mixed", label: "A mix of both" },
  { value: "student", label: "Student" },
  { value: "unemployed", label: "Not currently working" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option<string>[];

export const FITNESS_GOALS = [
  { value: "weight_loss", label: "Lose weight" },
  { value: "muscle_gain", label: "Build muscle" },
  { value: "endurance", label: "Improve endurance" },
  { value: "general_fitness", label: "Get generally fitter" },
  { value: "maintain", label: "Maintain where I am" },
] as const satisfies readonly Option<string>[];

export const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary (little movement)" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Moderately active" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very active" },
] as const satisfies readonly Option<string>[];

export const EXERCISE_FREQUENCIES = [
  { value: "none", label: "Rarely / never" },
  { value: "1-2", label: "1–2× a week" },
  { value: "3-4", label: "3–4× a week" },
  { value: "5-6", label: "5–6× a week" },
  { value: "daily", label: "Every day" },
] as const satisfies readonly Option<string>[];

export const SOCIAL_TENDENCIES = [
  { value: "homebody", label: "Homebody — I like staying in" },
  { value: "balanced", label: "A balance of in and out" },
  { value: "social", label: "Social — I like getting out a lot" },
] as const satisfies readonly Option<string>[];

export const PLANNING_SCOPES = [
  { value: "after_hours", label: "Just my after-work / free hours" },
  { value: "few_days", label: "A couple of days at a time" },
  { value: "full_week", label: "My full week" },
  { value: "weekends", label: "Mainly weekends" },
] as const satisfies readonly Option<string>[];

export const AUTO_PLAN_CADENCES = [
  { value: "off", label: "Off — I'll build it myself" },
  { value: "daily", label: "Every day" },
  { value: "few_times_week", label: "A few times a week" },
  { value: "weekly", label: "Weekly" },
] as const satisfies readonly Option<string>[];

export const WORK_DAYS = [
  { value: "Monday", label: "Mon" },
  { value: "Tuesday", label: "Tue" },
  { value: "Wednesday", label: "Wed" },
  { value: "Thursday", label: "Thu" },
  { value: "Friday", label: "Fri" },
  { value: "Saturday", label: "Sat" },
  { value: "Sunday", label: "Sun" },
] as const satisfies readonly Option<string>[];

export const SEXES = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const satisfies readonly Option<string>[];

export const CHORE_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "few_times_week", label: "A few times a week" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
] as const satisfies readonly Option<string>[];

export const CHORE_OPTIONS = [
  "Dishes",
  "Laundry",
  "Vacuuming",
  "Sweeping / mopping",
  "Bathroom cleaning",
  "Kitchen cleaning",
  "Take out trash",
  "Grocery shopping",
  "Meal prep",
  "Tidying / decluttering",
  "Dusting",
  "Yard work / lawn",
  "Pet care",
  "Change bedding",
  "Car care",
] as const;

export const HOBBY_SUGGESTIONS = [
  "Reading",
  "Gaming",
  "Cooking",
  "Hiking",
  "Gym",
  "Running",
  "Cycling",
  "Yoga",
  "Photography",
  "Music",
  "Art / painting",
  "Gardening",
  "Writing",
  "Movies / TV",
  "Travel",
  "Crafting / DIY",
  "Sports",
  "Meditation",
  "Dancing",
  "Socializing",
] as const;

export const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Gluten-free",
  "Dairy-free",
  "Lactose intolerant",
  "Nut allergy",
  "Peanut allergy",
  "Shellfish allergy",
  "Egg allergy",
  "Soy allergy",
  "Halal",
  "Kosher",
  "Keto",
  "Paleo",
  "Low-carb",
  "Low-sodium",
] as const;

export type ChoreFrequency = (typeof CHORE_FREQUENCIES)[number]["value"];
export interface ChoreEntry {
  name: string;
  frequency: ChoreFrequency;
}

export interface WorkoutExercise {
  name: string;
  sets?: string;
  reps?: string;
  notes?: string;
}
export interface WorkoutDay {
  day: string;
  focus?: string;
  exercises: WorkoutExercise[];
  cardio?: string;
}
export interface WorkoutProgram {
  split: string;
  days: WorkoutDay[];
  notes?: string;
}
export interface NutritionGuide {
  strategy: string;
  guidance: string[];
  sampleDay: { meal: string; idea: string }[];
}
export interface FitnessPlan {
  summary: string;
  calorie_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  workout: WorkoutProgram;
  nutrition: NutritionGuide;
  generated_at: string;
}

export interface UserPreferences {
  work_type: string | null;
  work_title: string | null;
  work_schedule: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  work_days: string[];
  wake_time: string | null;
  sleep_time: string | null;
  fitness_goal: string | null;
  activity_level: string | null;
  exercise_frequency: string | null;
  height_in: number | null;
  weight_lb: number | null;
  sex: string | null;
  birth_year: number | null;
  hobbies: string[];
  social_tendency: string | null;
  chores: ChoreEntry[];
  dietary_restrictions: string[];
  dietary_notes: string | null;
  planning_scope: string | null;
  auto_plan_cadence: string | null;
  onboarding_completed: boolean;
}
