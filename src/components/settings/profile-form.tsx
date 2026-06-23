"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { profileSchema } from "@/lib/validation";
import { updateProfile } from "@/actions/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types";

type FormValues = z.infer<typeof profileSchema>;

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.display_name ?? "",
      city: profile?.city ?? "",
      bio: profile?.bio ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result.ok) toast.success("Profile saved.");
      else toast.error(result.error);
    });
  }

  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your name personalizes your briefing; your city powers the weather card.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" autoComplete="name" {...form.register("displayName")} />
            {errors.displayName && (
              <p role="alert" className="text-sm text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">About you</Label>
            <Textarea
              id="bio"
              rows={2}
              maxLength={160}
              placeholder="A short line about you — your vibe, your goals, anything."
              {...form.register("bio")}
            />
            <p className="text-xs text-muted-foreground">Shown on your profile. Up to 160 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" placeholder="Copenhagen" {...form.register("city")} />
            <p className="text-xs text-muted-foreground">
              Used only to fetch local weather and set your timezone.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
