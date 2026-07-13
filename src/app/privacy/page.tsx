import Link from "next/link";
import { Sunrise } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Daybreak",
  description: "How Daybreak collects, uses, shares, and deletes personal information.",
};

const CONTACT = "valeyardvisuals@vlystudios.com";

export default function PrivacyPage() {
  return (
    <main className="bg-sunrise-soft min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="bg-sunrise shadow-soft flex h-9 w-9 items-center justify-center rounded-full">
              <Sunrise className="h-5 w-5 text-[#7a4a12]" aria-hidden />
            </span>
            Daybreak
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            Back home
          </Link>
        </header>

        <article className="text-foreground/90 space-y-7 text-sm leading-relaxed">
          <div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground mt-2">Last updated: July 13, 2026</p>
          </div>
          <p>
            Daybreak is a wellness and planning service, not a medical device. This policy explains
            what we collect, why we use it, which providers process it, and how you control it. We
            do not sell personal information. We do not use health information for advertising.
          </p>

          <PolicySection title="Information you provide and connect">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Account email, display name, profile details, city, and optional profile photo.
              </li>
              <li>
                Wellness data you authorize from Apple Health/HealthKit, Oura, and Fitbit, including
                sleep, activity, workouts, heart and recovery signals, weight, and body composition.
              </li>
              <li>Google Calendar events and schedules you create in Daybreak.</li>
              <li>City or coordinates you provide for local weather.</li>
              <li>
                Nutrition, body measurements, meals, grocery purchases, and dietary preferences.
              </li>
              <li>
                Daily check-in ratings and notes, goals, habits, workout data, and planning
                preferences.
              </li>
              <li>
                Meal, receipt, and profile photographs you choose. Meal and receipt images are
                transformed to remove EXIF/location metadata, processed transiently, and are not
                retained after analysis. Profile photos are stored until replaced, removed, or the
                account is deleted.
              </li>
              <li>
                Device push subscriptions, security events, and limited diagnostic/crash
                information.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="How we use information">
            <p>
              We use information to authenticate you; display wellness trends, schedules, nutrition,
              and plans; synchronize connected providers; deliver notifications and email; secure
              and troubleshoot the service; and respond to support requests. Daybreak reads
              HealthKit data only after your action, uploads imported summaries to its backend, and
              never writes to Apple Health.
            </p>
          </PolicySection>

          <PolicySection title="AI processing and your consent">
            <p>
              Daybreak uses OpenAI as an external processor for optional briefings, plans, coaching,
              photo analysis, and receipt analysis. LogMeal may process a meal photo when
              configured. Before any AI feature is used, Daybreak records the current disclosure
              version and your choices. Health summaries, calendar titles, and daily check-ins
              default to off and are sent only when the matching stored choice is explicitly on.
              Calendar titles become “Busy time” when title sharing is off. You may decline and
              receive a more general plan, or revoke any category immediately in Settings. HealthKit
              authorization is separate from AI consent. AI output is not used for diagnosis or
              treatment.
            </p>
          </PolicySection>

          <PolicySection title="Service providers and disclosures">
            <p>We disclose only what is needed for the service to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Supabase for authentication, database, and file storage.</li>
              <li>Vercel for application hosting and delivery.</li>
              <li>OpenAI and, when configured, LogMeal for user-initiated AI processing.</li>
              <li>
                Oura, Fitbit, Google Calendar, Apple Health, and weather providers for connected
                features.
              </li>
              <li>Sentry for redacted crash/diagnostic information.</li>
              <li>Resend for transactional email and web-push infrastructure for notifications.</li>
            </ul>
            <p>
              Friends and household sharing are disabled in the first public release. If enabled in
              a later release, this policy and in-app controls will be updated before information is
              shared.
            </p>
          </PolicySection>

          <PolicySection title="Retention, security, and your controls">
            <p>
              Account data is retained while your account is active and as needed to operate and
              secure Daybreak. Provider tokens are encrypted at rest. User rows are protected by
              row-level security. Diagnostic records are minimized and must not contain raw health
              values, prompts, photos, or provider tokens.
            </p>
            <p>
              In Settings you can export your data, delete your account in-app, disconnect
              providers, revoke AI categories, remove a profile photo, and disconnect Apple Health
              with an option to delete imported Apple data. HealthKit permission can also be revoked
              in iOS Settings. Account deletion removes user storage, provider credentials, push
              subscriptions, sharing relationships, personal rows, and then the authentication
              account. Non-identifying shared catalog entries may remain after the creator link is
              removed so other users’ records are not damaged.
            </p>
          </PolicySection>

          <PolicySection title="Contact and changes">
            <p>
              Questions or privacy requests can be sent to{" "}
              <a className="text-primary underline" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
              . We may update this policy and will change the date above when we do.
            </p>
          </PolicySection>
        </article>
      </div>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
