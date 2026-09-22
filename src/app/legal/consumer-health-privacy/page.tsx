import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Consumer Health Data Privacy" };

export default function ConsumerHealthPrivacyPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage
      title="Consumer Health Data Privacy Policy"
      effectiveDate={identity.healthPrivacyEffectiveDate}
    >
      <p>
        This policy supplements the Privacy Policy for consumer health data processed by Daybreak.
        Daybreak is a wellness and planning service, not a healthcare provider or medical device.
      </p>
      <LegalSection title="Consumer health data and sources">
        <LegalList>
          <li>
            Sleep, activity, workout, heart-rate, HRV, recovery, energy, and related summaries.
          </li>
          <li>
            Weight, body-composition, nutrition, hydration, mood, stress, soreness, and check-ins.
          </li>
          <li>
            Derived wellness trends, confidence, provenance, and AI-generated interpretations.
          </li>
          <li>
            Apple Health, Oura, Fitbit, manual entries, and information you upload or connect.
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection title="Why we collect and use it">
        <p>
          Daybreak uses these categories only to display user-requested trends, identify data
          quality and source conflicts, adapt a general wellness plan, answer a user-requested
          check-in, and secure or support those features. HealthKit access starts only after the
          user enables it; the app requests read access only and does not write fabricated or
          generated data to HealthKit.
        </p>
      </LegalSection>
      <LegalSection title="Sharing and sales">
        <p>
          Daybreak does not sell consumer health data and does not use it for advertising, tracking,
          attribution, marketing profiles, data-broker activity, or unrelated analytics. Supabase
          and Vercel process it to host the service. Apple Health, Oura, and Fitbit provide
          user-authorized source data. OpenAI may receive minimized health context only when both
          current basic AI consent and health-specific AI consent are active. LogMeal does not
          receive health records. Resend, push services, Sentry, analytics, and notifications are
          prohibited from receiving health values or health-derived text.
        </p>
      </LegalSection>
      <LegalSection title="Your health-data rights">
        <p>
          In Settings you can confirm processing; access or export information; request correction
          or deletion; withdraw AI consent; stop future collection or sharing where applicable;
          request applicable third-party categories; disconnect a source; and appeal a denial.
          Requests are bound to the authenticated account, status-tracked, and targeted for response
          within the displayed deadline. Exercising a right does not result in retaliation. Some
          corrections are made by replacing the source record; immutable acceptance,
          consent-history, and security events remain historical evidence and are not rewritten, but
          may be annotated where appropriate.
        </p>
      </LegalSection>
      <LegalSection title="Retention and deletion">
        <p>
          Active health records remain until the user deletes them, disconnects with deletion, or
          deletes the account. Account deletion removes raw and derived Daybreak-held health
          records, generated plans, credentials, files, caches, and authentication through a
          retryable job. Isolated backups expire under the provider lifecycle described in the
          Retention and Deletion page. Narrow legal or security holds are applied only when
          required.
        </p>
      </LegalSection>
      <LegalSection title="Contact and complaints">
        <p>
          Submit and track a request in Settings, or contact{" "}
          <a className="text-primary underline" href={`mailto:${identity.privacyEmail}`}>
            {identity.privacyEmail}
          </a>
          . Include no health details in ordinary email. Complaints and appeals receive human review
          where required.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
