"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, signupSchema } from "@/lib/validation";
import { publicEnv } from "@/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup" | "reset";

type SignupValues = z.infer<typeof signupSchema>;

const RESET_REDIRECT = `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/update-password`;

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, setPending] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<SignupValues>({
    resolver: zodResolver(mode === "signup" ? signupSchema : (loginSchema as typeof signupSchema)),
    defaultValues: { email: "", password: "", displayName: "" },
  });

  async function onSubmit(values: SignupValues) {
    setPending(true);
    setNeedsConfirm(null);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { display_name: values.displayName },
            emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
          },
        });
        if (error) throw error;
        toast.success("Almost there! Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong — please try again.";
      if (/confirm/i.test(message)) setNeedsConfirm(values.email);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function sendReset() {
    const email = form.getValues("email");
    if (!z.email().safeParse(email).success) {
      form.setError("email", { message: "Enter a valid email" });
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT });
    setPending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email for a link to reset your password.");
      setMode("signin");
    }
  }

  async function resendConfirmation() {
    if (!needsConfirm) return;
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: needsConfirm });
    if (error) toast.error(error.message);
    else toast.success("Confirmation email sent again — check your inbox.");
  }

  const { errors } = form.formState;

  const title =
    mode === "signup" ? "Welcome to Daybreak" : mode === "reset" ? "Reset your password" : "Welcome back";
  const description =
    mode === "signup"
      ? "A calmer way to start every morning."
      : mode === "reset"
        ? "We'll email you a secure link to set a new one."
        : "Your morning briefing is waiting.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <Card className="glass border-none">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "reset" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...form.register("email")}
                />
                {errors.email && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <Button type="button" className="w-full" size="lg" disabled={pending} onClick={sendReset}>
                {pending ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Back to sign in
                </button>
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName">What should we call you?</Label>
                    <Input id="displayName" autoComplete="given-name" placeholder="Sam" {...form.register("displayName")} />
                    {errors.displayName && (
                      <p role="alert" className="text-sm text-destructive">
                        {errors.displayName.message}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />
                  {errors.email && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setMode("reset")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    {...form.register("password")}
                  />
                  {errors.password && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={pending}>
                  {pending ? "One moment…" : mode === "signup" ? "Create my account" : "Sign in"}
                </Button>
              </form>

              {needsConfirm && (
                <div className="mt-4 rounded-xl bg-honey-soft/50 p-3 text-center text-sm">
                  <p className="text-muted-foreground">Your email isn&apos;t confirmed yet.</p>
                  <button
                    type="button"
                    className="mt-1 font-medium text-primary underline-offset-4 hover:underline"
                    onClick={resendConfirmation}
                  >
                    Resend confirmation email
                  </button>
                </div>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account?" : "New to Daybreak?"}{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                >
                  {mode === "signup" ? "Sign in" : "Create an account"}
                </button>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
