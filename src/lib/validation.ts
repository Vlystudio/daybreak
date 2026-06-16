import { z } from "zod";

/** Zod schemas shared by client forms (react-hook-form) and server actions. */

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
  password: z.string().min(8, "At least 8 characters"),
});

export const signupSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, "Tell us what to call you").max(80),
});

export const calendarSyncSchema = z.object({
  syncEnabled: z.boolean(),
});

export const uuidSchema = z.uuid();
