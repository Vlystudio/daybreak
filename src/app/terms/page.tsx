import Link from "next/link";
import { Sunrise } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service · Daybreak" };
const CONTACT = "valeyardvisuals@vlystudios.com";

export default function TermsPage() {
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
          <Link href="/" className="text-muted-foreground text-sm">
            Back home
          </Link>
        </header>
        <article className="text-foreground/90 space-y-6 text-sm leading-relaxed">
          <div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              Terms of Service
            </h1>
            <p className="text-muted-foreground mt-2">Last updated: July 13, 2026</p>
          </div>
          <p>
            These terms govern your use of Daybreak. If you do not agree, do not use the service.
          </p>
          <TermsSection title="1. Wellness and planning service">
            Daybreak organizes schedules, nutrition, workouts, habits, connected wellness data, and
            optional AI-generated suggestions. The first public release is free. No subscription or
            paid digital feature is offered in this release.
          </TermsSection>
          <TermsSection title="2. Not medical advice">
            Daybreak is not a medical device and does not provide diagnosis, treatment, or emergency
            services. AI and wellness suggestions are general information. Seek qualified
            professional care for medical concerns and emergency services when appropriate.
          </TermsSection>
          <TermsSection title="3. Accounts and eligibility">
            You must be at least 16, provide accurate account information, protect your credentials,
            and promptly report unauthorized access. You are responsible for activity under your
            account.
          </TermsSection>
          <TermsSection title="4. Connected and AI services">
            Features may depend on Apple Health, Oura, Fitbit, Google, OpenAI, LogMeal, Supabase,
            Vercel, Sentry, Resend, and weather or notification services. You choose whether to
            connect optional providers and whether specified personal categories may be sent for AI
            processing. Third-party availability and terms also apply.
          </TermsSection>
          <TermsSection title="5. Your content and acceptable use">
            You retain ownership of content you provide and grant Daybreak a limited license to
            process it only to operate the service as described in the{" "}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            . Do not access another person’s data, interfere with the service, upload unlawful
            content, evade security controls, or violate connected-provider terms.
          </TermsSection>
          <TermsSection title="6. Availability and disclaimers">
            The service is provided “as is” and may occasionally be unavailable or produce
            incomplete information. Verify important schedule, nutrition, workout, and wellness
            decisions yourself. To the extent permitted by law, Daybreak is not liable for indirect
            or consequential losses.
          </TermsSection>
          <TermsSection title="7. Termination and deletion">
            You may stop using Daybreak and delete your account in Settings at any time. We may
            suspend access to protect users or the service or address a violation. Provisions that
            by nature survive termination remain effective.
          </TermsSection>
          <TermsSection title="8. Changes and contact">
            We may update these terms and will revise the date above. Questions may be sent to{" "}
            <a className="text-primary underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </TermsSection>
        </article>
      </div>
    </main>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
