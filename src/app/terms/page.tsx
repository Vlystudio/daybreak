import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage title="Terms of Service" effectiveDate={identity.termsEffectiveDate}>
      <p>
        These Terms form an agreement between you and {identity.operatorName}. If you do not agree,
        do not create or use an account. The current release is free and offers no paid digital
        feature or automatically renewing subscription.
      </p>
      <LegalSection title="1. Eligibility and account responsibility">
        <p>
          You must be at least 18, have authority to enter this agreement, and make a truthful adult
          self-attestation. Keep account information accurate and credentials secure; do not share
          an account or access another person&apos;s account. Daybreak may restrict or terminate
          access for safety, law, security, or violations. Accounts known to belong to minors are
          not permitted.
        </p>
      </LegalSection>
      <LegalSection title="2. Wellness service; no emergency or medical care">
        <p>
          Daybreak provides general wellness, planning, organization, nutrition, and fitness
          information. It is not a medical device, clinician, therapist, dietitian, or emergency
          service, and it does not diagnose, treat, cure, or prevent disease. Do not use it for an
          emergency. Contact local emergency services for urgent danger and consult qualified
          professionals before making medical decisions.
        </p>
      </LegalSection>
      <LegalSection title="3. AI limitations and user decisions">
        <p>
          Optional AI outputs can be inaccurate, incomplete, biased, or inappropriate. Review all
          generated plans and recommendations before acting. Daybreak does not guarantee results or
          medical accuracy. AI may not prescribe, stop, or dose medication. Your granular AI consent
          controls future sharing and is independent of these Terms.
        </p>
      </LegalSection>
      <LegalSection title="4. Third-party services">
        <p>
          Optional Apple Health, Oura, Fitbit, Google, AI, email, weather, recipe, and notification
          services have separate terms, availability, and permissions. You authorize only the
          connections you select and may disconnect them. Daybreak is not responsible for a third
          party&apos;s independent service, but remains responsible for its own obligations under
          law.
        </p>
      </LegalSection>
      <LegalSection title="5. Content, intellectual property, and feedback">
        <p>
          You retain ownership of content you provide and grant Daybreak a limited, nonexclusive
          license to host, process, reproduce, and transmit it only as needed to operate and improve
          the service according to your permissions and the Privacy Policy. You represent that you
          may provide that content. Daybreak software, branding, and first-party assets remain the
          property of their owners. Feedback may be used without restriction or compensation, but
          does not transfer your personal content.
        </p>
      </LegalSection>
      <LegalSection title="6. Acceptable use">
        <p>
          Follow the{" "}
          <Link className="text-primary underline" href="/legal/acceptable-use">
            Acceptable Use Policy
          </Link>
          . Do not break law, violate rights, evade access or consent controls, introduce malicious
          code, scrape or overload the service, reverse engineer where prohibited, or use output to
          harm a person. You may not use Daybreak for clinical diagnosis or emergency response.
        </p>
      </LegalSection>
      <LegalSection title="7. Availability, changes, and termination">
        <p>
          Daybreak is provided on an “as available” basis and may change, experience outages, or
          discontinue features. Where reasonable, material changes receive notice. You can stop
          using Daybreak and delete your account in Settings. Terms that by their nature survive,
          including ownership and lawful limitations, continue after termination.
        </p>
      </LegalSection>
      <LegalSection title="8. Warranties and liability">
        <p>
          To the maximum extent permitted by law, Daybreak disclaims implied warranties and does not
          guarantee uninterrupted availability, error-free output, particular results, or data-loss
          prevention. To the maximum extent permitted, neither party is liable for indirect,
          incidental, special, exemplary, or consequential damages. Any aggregate liability cap and
          jurisdiction-specific exclusions apply only as permitted by mandatory law and as stated in
          a counsel-approved version; these Terms do not waive privacy, breach-notification,
          consumer, Apple-required, or other non-waivable rights.
        </p>
      </LegalSection>
      <LegalSection title="9. General terms">
        <p>
          You are responsible for claims caused by your unlawful content or intentional misuse to
          the extent lawful. Neither party is liable for delay caused by events beyond reasonable
          control. If a provision is unenforceable, the remainder continues; failure to enforce is
          not a waiver. You may not assign these Terms without consent; Daybreak may assign them
          with a lawful business transfer. These Terms and incorporated policies are the entire
          agreement. Governing law and venue are {identity.governingJurisdiction}, subject to
          mandatory local rights. No arbitration or class-action waiver applies unless separately
          approved by counsel, clearly disclosed, and validly accepted.
        </p>
      </LegalSection>
      <LegalSection title="10. Changes and contact">
        <p>
          Material changes requiring acceptance are versioned and presented before continued use.
          Contact{" "}
          <a className="text-primary underline" href={`mailto:${identity.supportEmail}`}>
            {identity.supportEmail}
          </a>{" "}
          or write to {identity.businessAddress}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
