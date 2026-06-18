import Link from "next/link";
import { Sunrise } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Daybreak",
  description: "How Daybreak collects, uses, and protects your data.",
};

const UPDATED = "June 18, 2026";
const CONTACT = "valeyardvisuals@vlystudios.com";

export default function PrivacyPage() {
  return (
    <main className="bg-sunrise-soft min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="bg-sunrise flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
              <Sunrise className="h-5 w-5 text-[#7a4a12]" aria-hidden />
            </span>
            Daybreak
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back home
          </Link>
        </header>

        <article className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="mt-2 text-muted-foreground">Last updated: {UPDATED}</p>
          </div>

          <p>
            Daybreak (&ldquo;Daybreak,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is a personal
            morning-wellness dashboard that brings together your sleep and readiness data, calendar,
            local weather, and an AI morning briefing. This policy explains what we collect, how we
            use it, and the choices you have. We collect the minimum needed to provide the service
            and we never sell your data.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Account information</strong> — your email address and an optional display
                name, used to create and secure your account.
              </li>
              <li>
                <strong>Health &amp; activity data</strong> — when you connect Oura, we retrieve
                sleep, readiness, heart-rate variability (HRV), and related metrics, with your
                explicit authorization, to display your daily wellness picture.
              </li>
              <li>
                <strong>Calendar data</strong> — when you connect Google Calendar, we read your
                events to show them alongside your schedule.
              </li>
              <li>
                <strong>Location</strong> — an approximate location (city or coordinates) you provide,
                used only to fetch local weather.
              </li>
              <li>
                <strong>Schedule you create</strong> — events and notes you enter manually in the app.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">How we use your information</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>To display your dashboard: sleep, readiness, HRV, weather, and schedule.</li>
              <li>
                To generate your AI morning briefing. Relevant metrics are sent to OpenAI solely to
                produce that briefing; they are not used to train models.
              </li>
              <li>To operate, secure, and improve the service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">How your data is protected</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Every record is protected by row-level security; you can only access your own data
                (and household-shared events you are a member of).
              </li>
              <li>
                Connection tokens for Oura and Google are encrypted at rest (AES-256-GCM) and are
                never exposed to the browser.
              </li>
              <li>Health values are never written to application logs.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Third-party services</h2>
            <p>We share data with these providers only as needed to run Daybreak:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Supabase</strong> — database, authentication, and hosting of your data.</li>
              <li><strong>OpenAI</strong> — generates your morning briefing from the metrics you provide.</li>
              <li><strong>Oura</strong> — source of sleep, readiness, and heart-rate data you authorize.</li>
              <li><strong>Google Calendar</strong> — source of calendar events you authorize.</li>
              <li><strong>Open-Meteo</strong> — weather data for your location.</li>
              <li><strong>Vercel</strong> — application hosting.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Your choices &amp; data deletion</h2>
            <p>
              You can disconnect Oura or Google at any time in Settings, which removes the stored
              connection and its tokens. You may request deletion of your account and associated data
              by contacting us at{" "}
              <a className="text-primary underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. We
              retain your data only for as long as your account is active or as needed to provide the
              service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by the
              &ldquo;Last updated&rdquo; date above.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p>
              Questions about this policy? Email{" "}
              <a className="text-primary underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
