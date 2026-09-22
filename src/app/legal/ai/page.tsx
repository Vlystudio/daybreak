import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "AI Processing and Output Disclosure" };

export default function AiDisclosurePage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage
      title="AI Processing and Output Disclosure"
      effectiveDate={identity.privacyEffectiveDate}
    >
      <p>
        AI is optional. Daybreak uses OpenAI for user-requested briefings, plans, coaching, and
        image analysis, and may use LogMeal for meal-image analysis when that reviewed provider is
        enabled.
      </p>
      <LegalSection title="Your granular choices">
        <LegalList>
          <li>Basic processing of direct feature input.</li>
          <li>Tasks and plan context.</li>
          <li>Check-in context.</li>
          <li>Health and wellness context.</li>
          <li>Calendar availability, separately from titles and descriptions.</li>
          <li>Profile preferences and uploaded content.</li>
        </LegalList>
        <p>
          All choices start off. Sensitive choices do not imply one another. Detailed calendar
          sharing requires availability sharing; without detail authorization, occupied time is
          represented as “Busy time.” Consent is versioned, expires, and can be revoked in Settings.
          Revocation invalidates permits, queued context, and caches before another request can
          leave Daybreak.
        </p>
      </LegalSection>
      <LegalSection title="Provider handling">
        <p>
          The gateway sends only categories required for the selected feature through a short-lived,
          user- and purpose-bound authorization. The OpenAI API does not use API business data for
          training by default; provider abuse-monitoring retention may apply unless Daybreak&apos;s
          approved project has stricter controls. Production use remains disabled until contract,
          data-processing, retention, region, security, and owner approvals are recorded.
        </p>
      </LegalSection>
      <LegalSection title="Output safety">
        <p>
          Outputs are probabilistic and can be inaccurate, incomplete, biased, or inappropriate.
          Daybreak validates structure and allowed actions, but you must review output. AI cannot
          change consent, legal acceptance, measured health records, subscription state, or another
          user&apos;s data, and must not diagnose or prescribe medication. For urgent danger,
          contact local emergency services; Daybreak cannot contact them for you.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
