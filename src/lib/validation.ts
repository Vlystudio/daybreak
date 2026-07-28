import { z } from "zod";
import {
  WORK_TYPES,
  FITNESS_GOALS,
  ACTIVITY_LEVELS,
  EXERCISE_FREQUENCIES,
  SOCIAL_TENDENCIES,
  PLANNING_SCOPES,
  AUTO_PLAN_CADENCES,
  SEXES,
  CHORE_FREQUENCIES,
  type Option,
} from "@/lib/planning";

/** Zod schemas shared by client forms (react-hook-form) and server actions. */

const enumValues = (opts: readonly Option<string>[]) =>
  opts.map((o) => o.value) as [string, ...string[]];

export const eventColorSchema = z.enum(["honey", "sage", "sky", "peach"]);

export const scheduleEventSchema = z
  .object({
    title: z.string().trim().min(1, "Give your event a name").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    location: z.string().trim().max(300).optional().or(z.literal("")),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    allDay: z.boolean().default(false),
    color: eventColorSchema.default("honey"),
    shareWithHousehold: z.boolean().default(false),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "End time must be after the start time",
    path: ["endsAt"],
  });

export type ScheduleEventInput = z.input<typeof scheduleEventSchema>;

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us what to call you").max(80),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(160).optional().or(z.literal("")),
});

export type ProfileInput = z.input<typeof profileSchema>;

export const householdCreateSchema = z.object({
  name: z.string().trim().min(1, "Name your household").max(80),
});

export const householdJoinSchema = z.object({
  inviteCode: z.string().trim().min(6, "Enter the invite code").max(64),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  // Do not lock out a legacy account with a shorter provider-managed password.
  password: z.string().min(1, "Enter your password").max(200),
});

export const signupSchema = loginSchema.extend({
  password: z.string().min(12, "Use at least 12 characters").max(200),
  displayName: z.string().trim().min(1, "Tell us what to call you").max(80),
  adultAttested: z
    .boolean()
    .refine((value) => value, "You must confirm that you are at least 18 years old"),
  acceptedTerms: z.boolean().refine((value) => value, "You must accept the Terms of Service"),
  privacyAcknowledged: z
    .boolean()
    .refine((value) => value, "You must acknowledge the Privacy Policy"),
});

export const calendarSyncSchema = z.object({
  syncEnabled: z.boolean(),
});

export const uuidSchema = z.uuid();

export const choreEntrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  frequency: z.enum(enumValues(CHORE_FREQUENCIES)),
});

export const onboardingSchema = z.object({
  workType: z.enum(enumValues(WORK_TYPES)),
  workTitle: z.string().trim().max(120).optional().or(z.literal("")),
  workSchedule: z.string().trim().max(200).optional().or(z.literal("")),
  workStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .optional()
    .or(z.literal("")),
  workEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .optional()
    .or(z.literal("")),
  workDays: z.array(z.string().trim().min(1).max(12)).max(7).default([]),
  wakeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .optional()
    .or(z.literal("")),
  sleepTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .optional()
    .or(z.literal("")),
  fitnessGoal: z.enum(enumValues(FITNESS_GOALS)),
  activityLevel: z.enum(enumValues(ACTIVITY_LEVELS)),
  exerciseFrequency: z.enum(enumValues(EXERCISE_FREQUENCIES)),
  heightIn: z.coerce.number().min(36, "Enter a valid height").max(96).optional(),
  weightLb: z.coerce.number().min(50, "Enter a valid weight").max(800).optional(),
  sex: z.enum(enumValues(SEXES)).optional(),
  hobbies: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  socialTendency: z.enum(enumValues(SOCIAL_TENDENCIES)),
  chores: z.array(choreEntrySchema).max(40).default([]),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  dietaryNotes: z.string().trim().max(500).optional().or(z.literal("")),
  planningScope: z.enum(enumValues(PLANNING_SCOPES)),
  autoPlanCadence: z.enum(enumValues(AUTO_PLAN_CADENCES)).optional(),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
