import Link from "next/link";
import { Sunrise } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Daybreak",
  description: "The terms governing your use of Daybreak.",
};

const UPDATED = "June 18, 2026";
const CONTACT = "valeyardvisuals@vlystudios.com";

export default function TermsPage() {
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
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
            <p className="mt-2 text-muted-foreground">Last updated: {UPDATED}</p>
          </div>

          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Daybreak (the
            &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these
            Terms. If you do not agree, please do not use the Service.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. The Service</h2>
            <p>
              Daybreak is a personal wellness dashboard that aggregates your sleep and readiness data,
              calendar, local weather, and an AI-generated morning briefing. Features that rely on
              third-party integrations (such as Oura and Google Calendar) require you to connect those
              accounts.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Eligibility &amp; accounts</h2>
            <p>
              You must be at least 16 years old to use the Service. You are responsible for the
              activity under your account and for keeping your login credentials secure. Notify us
              promptly of any unauthorized use.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Not medical advice</h2>
            <p>
              Daybreak presents wellness information and AI-generated suggestions for general,
              informational purposes only. It is <strong>not</strong> a medical device and does not
              provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare
              professional regarding your health. Do not disregard professional medical advice because
              of something you read in Daybreak.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable use</h2>
            <p>
              You agree not to misuse the Service, including attempting to access other users&rsquo;
              data, disrupting the Service, reverse-engineering it, or using it to violate any
              applicable law or the terms of connected providers (e.g., Oura, Google).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Third-party services</h2>
            <p>
              The Service integrates with third parties including Oura, Google, OpenAI, Open-Meteo,
              Supabase, and Vercel. Your use of those integrations is also subject to their respective
              terms and privacy policies. We are not responsible for third-party services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Your content &amp; data</h2>
            <p>
              You retain ownership of the data you provide and connect. You grant us a limited license
              to process it solely to operate the Service as described in our{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Disclaimers &amp; limitation of liability</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
              maximum extent permitted by law, we are not liable for any indirect, incidental, or
              consequential damages arising from your use of the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Termination</h2>
            <p>
              You may stop using the Service and delete your account at any time. We may suspend or
              terminate access if you violate these Terms or to protect the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">9. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use after changes take effect
              constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a className="text-primary underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
