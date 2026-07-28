"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import {
  requestPasswordReset,
  resendSignupConfirmation,
  signInAccount,
  signUpAccount,
} from "@/actions/auth";
import { loginSchema, signupSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup" | "reset";
type SignupValues = z.infer<typeof signupSchema>;

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, setPending] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [under18, setUnder18] = useState(false);
  const router = useRouter();

  const form = useForm<SignupValues>({
    resolver: zodResolver(
      mode === "signup" ? signupSchema : (loginSchema as typeof signupSchema)
    ) as Resolver<SignupValues>,
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      adultAttested: false,
      acceptedTerms: false,
      privacyAcknowledged: false,
    },
  });

  async function onSubmit(values: SignupValues) {
    setPending(true);
    setNeedsConfirm(null);
    try {
      if (mode === "signup") {
        const result = await signUpAccount(values);
        if (!result.ok) throw new Error(result.error);
        toast.success("Almost there! Check your email to confirm your account.");
      } else {
        const result = await signInAccount({ email: values.email, password: values.password });
        if (!result.ok) throw new Error(result.error);
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
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
    const result = await requestPasswordReset({ email });
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("If an account exists, a password-reset link has been sent.");
      setMode("signin");
    }
  }

  async function resendConfirmation() {
    if (!needsConfirm) return;
    const result = await resendSignupConfirmation({ email: needsConfirm });
    if (!result.ok) toast.error(result.error);
    else toast.success("If eligible, a confirmation email has been sent.");
  }

  const { errors } = form.formState;
  const title =
    mode === "signup"
      ? "Welcome to Daybreak"
      : mode === "reset"
        ? "Reset your password"
        : "Welcome back";
  const description =
    mode === "signup"
      ? "A calmer way to start every morning. Adults 18+ only."
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
                  aria-label="Account email"
                  data-testid="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...form.register("email")}
                />
                {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
              </div>
              <Button
                type="button"
                className="w-full"
                size="lg"
                disabled={pending}
                onClick={sendReset}
              >
                {pending ? "Sending…" : "Send reset link"}
              </Button>
              <ModeButton onClick={() => setMode("signin")}>Back to sign in</ModeButton>
            </div>
          ) : (
            <>
              {mode === "signup" && under18 ? (
                <div className="space-y-4" role="status">
                  <div className="bg-honey-soft/50 rounded-xl p-4 text-sm">
                    Daybreak is available only to adults aged 18 or older. No account has been
                    created, and Daybreak will not start health, calendar, integration, or AI
                    processing from this selection.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setUnder18(false)}
                  >
                    Back
                  </Button>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="displayName">What should we call you?</Label>
                      <Input
                        id="displayName"
                        aria-label="Signup display name"
                        data-testid="signup-display-name"
                        autoComplete="given-name"
                        placeholder="Sam"
                        {...form.register("displayName")}
                      />
                      {errors.displayName && <ErrorText>{errors.displayName.message}</ErrorText>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      aria-label="Account email"
                      data-testid="auth-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...form.register("email")}
                    />
                    {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          className="text-primary text-xs font-medium underline-offset-4 hover:underline"
                          onClick={() => setMode("reset")}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      aria-label="Account password"
                      data-testid="auth-password"
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="••••••••"
                      {...form.register("password")}
                    />
                    {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
                  </div>

                  {mode === "signup" && (
                    <div className="space-y-3 rounded-xl border p-3">
                      <ConsentCheckbox
                        testId="signup-adult-attestation"
                        registration={form.register("adultAttested")}
                      >
                        I confirm that I am at least 18 years old and legally eligible to use
                        Daybreak.
                      </ConsentCheckbox>
                      {errors.adultAttested && (
                        <ErrorText>{errors.adultAttested.message}</ErrorText>
                      )}

                      <ConsentCheckbox
                        testId="signup-terms-acceptance"
                        registration={form.register("acceptedTerms")}
                      >
                        I accept the current{" "}
                        <a
                          className="text-primary underline"
                          href="/terms"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Terms of Service
                        </a>
                        .
                      </ConsentCheckbox>
                      {errors.acceptedTerms && (
                        <ErrorText>{errors.acceptedTerms.message}</ErrorText>
                      )}

                      <ConsentCheckbox
                        testId="signup-privacy-acknowledgment"
                        registration={form.register("privacyAcknowledged")}
                      >
                        I acknowledge the current{" "}
                        <a
                          className="text-primary underline"
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Privacy Policy
                        </a>
                        .
                      </ConsentCheckbox>
                      {errors.privacyAcknowledged && (
                        <ErrorText>{errors.privacyAcknowledged.message}</ErrorText>
                      )}

                      <button
                        type="button"
                        id="signup-under-18"
                        data-testid="signup-under-18"
                        className="text-muted-foreground text-xs underline"
                        onClick={() => setUnder18(true)}
                      >
                        I am under 18
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    id="auth-submit"
                    data-testid="auth-submit"
                    className="w-full"
                    size="lg"
                    disabled={pending}
                  >
                    {pending ? "One moment…" : mode === "signup" ? "Create my account" : "Sign in"}
                  </Button>
                </form>
              )}

              {needsConfirm && (
                <div className="bg-honey-soft/50 mt-4 rounded-xl p-3 text-center text-sm">
                  <p className="text-muted-foreground">Your email isn&apos;t confirmed yet.</p>
                  <button
                    type="button"
                    className="text-primary mt-1 font-medium underline-offset-4 hover:underline"
                    onClick={resendConfirmation}
                  >
                    Resend confirmation email
                  </button>
                </div>
              )}

              <p className="text-muted-foreground mt-6 text-center text-sm">
                {mode === "signup" ? "Already have an account?" : "New to Daybreak?"}{" "}
                <button
                  type="button"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                  onClick={() => {
                    setUnder18(false);
                    setMode(mode === "signup" ? "signin" : "signup");
                  }}
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

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  );
}

function ModeButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <p className="text-muted-foreground text-center text-sm">
      <button
        type="button"
        className="text-primary font-medium underline-offset-4 hover:underline"
        onClick={onClick}
      >
        {children}
      </button>
    </p>
  );
}

function ConsentCheckbox({
  children,
  registration,
  testId,
}: {
  children: React.ReactNode;
  registration: UseFormRegisterReturn;
  testId: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        id={testId}
        type="checkbox"
        data-testid={testId}
        className="mt-1 h-4 w-4"
        {...registration}
      />
      <span>{children}</span>
    </label>
  );
}
