import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Daybreak collects, uses, shares, retains, and deletes personal information.",
};

export default function PrivacyPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage title="Privacy Policy" effectiveDate={identity.privacyEffectiveDate}>
      <p>
        {identity.operatorName} operates Daybreak, an adult-only wellness and planning service. This
        policy describes Daybreak&apos;s actual data handling. Daybreak does not sell personal
        information, serve third-party advertising, or track people across other companies&apos;
        apps or websites. Health information is never used for advertising or marketing profiles.
      </p>

      <LegalSection title="Information and sources">
        <LegalList>
          <li>
            Account email, display name, preferences, city or coordinates, and optional avatar.
          </li>
          <li>Adult self-attestation and versioned Terms and Privacy acceptance records.</li>
          <li>
            Tasks, plans, schedules, goals, habits, check-ins, nutrition, workouts, and grocery
            records.
          </li>
          <li>
            Health and fitness summaries you direct Apple Health, Oura, Fitbit, or manual entry to
            provide, including provenance, timestamps, units, and derived wellness results.
          </li>
          <li>Google Calendar availability and, when authorized, titles and descriptions.</li>
          <li>
            Meal, receipt, and profile images you choose. Meal and receipt images are normalized to
            remove embedded metadata and processed transiently; an avatar is stored until removed.
          </li>
          <li>
            AI consent choices, direct feature input, minimized AI context, and validated generated
            plans or summaries. Daybreak does not retain raw provider request/response logs.
          </li>
          <li>
            Connected-provider status, encrypted OAuth credentials, notification endpoints, security
            events, limited usage events, crash diagnostics, and support or rights requests.
          </li>
        </LegalList>
        <p>
          The first public release is free and has no StoreKit purchase or subscription processing.
          Daybreak will update its implementation and disclosures before offering paid features.
        </p>
      </LegalSection>

      <LegalSection title="Purposes">
        <p>
          Daybreak uses information to authenticate and protect accounts; provide planning,
          calendar, nutrition, wellness, and integration features; deliver neutral notifications;
          process user-requested exports and rights requests; maintain reliability; and comply with
          law. Optional AI processing occurs only under current, purpose- and category-specific
          consent. HealthKit authorization, legal acceptance, and payment do not grant AI consent.
        </p>
      </LegalSection>

      <LegalSection title="Processors and sharing">
        <p>
          Necessary data may be processed by Supabase (database, authentication, storage), Vercel
          (hosting), Sentry (redacted diagnostics), Resend and web-push infrastructure
          (notifications), and connected services the user selects. Oura, Fitbit, Google Calendar,
          Apple Health, weather, recipe, and grocery-data services process requests needed for their
          features. OpenAI or LogMeal receives only separately authorized AI categories. Daybreak
          may also disclose information when legally required, to protect rights and safety, or in a
          business transaction subject to applicable notice and protections.
        </p>
        <p>
          Providers may process information in other regions under their contractual transfer
          mechanisms. The current processor categories and purposes appear in the Consumer Health
          Data Privacy Policy and AI Disclosure.
        </p>
      </LegalSection>

      <LegalSection title="Health restrictions, analytics, and notifications">
        <p>
          Health, mental-wellness, check-in, calendar-detail, prompt, and image content is blocked
          from analytics, logs, crash breadcrumbs, traces, session replay, marketing, and remote
          notification payloads. Notifications only state that content is ready inside the
          authenticated app. Product analytics is allowlisted, does not permit sensitive fields, and
          is not used for tracking or advertising.
        </p>
      </LegalSection>

      <LegalSection title="Retention, deletion, and security">
        <p>
          User content is generally retained while the account is active. Short-lived authorization
          permits, caches, rate-limit records, diagnostics, deletion receipts, and analytics follow
          the published retention schedule. Account deletion restricts access immediately, revokes
          provider credentials, removes storage and user-owned records, invalidates AI work and
          sessions, and deletes the authentication account through a retryable job. Encrypted or
          isolated backups expire under the configured provider lifecycle and are not returned to
          active use except for permitted recovery, security, or legal needs.
        </p>
        <p>
          Daybreak uses HTTPS in transit, encrypted provider tokens, row-level access controls,
          least-privilege server operations, rate limits, and redacted diagnostics. No system is
          completely secure; report concerns through the Security page.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          Settings provides portable export, profile correction, integration disconnect, AI consent
          withdrawal, Apple Health data removal, notification controls, formal privacy and
          consumer-health requests with status and appeal, and in-app account deletion. Rights may
          include confirmation, access, correction, deletion, cessation of collection or sharing,
          third-party information, consent withdrawal, and appeal depending on jurisdiction. We
          verify authenticated requests and do not retaliate for exercising rights.
        </p>
      </LegalSection>

      <LegalSection title="Adults, changes, and contact">
        <p>
          Daybreak is limited to people aged 18 or older and does not intentionally collect data
          from known minors. Accounts credibly known to belong to a minor are restricted and queued
          for deletion; there is no parental-consent conversion. Material policy changes are not
          silently applied when renewed acceptance or consent is required.
        </p>
        <p>
          Contact{" "}
          <a className="text-primary underline" href={`mailto:${identity.privacyEmail}`}>
            {identity.privacyEmail}
          </a>{" "}
          for privacy requests or complaints. Business contact: {identity.businessAddress}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
