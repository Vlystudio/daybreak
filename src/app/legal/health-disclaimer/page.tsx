import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Health and Medical Disclaimer" };

export default function HealthDisclaimerPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage
      title="Health and Medical Disclaimer"
      effectiveDate={identity.healthPrivacyEffectiveDate}
    >
      <LegalSection title="General wellness only">
        <p>
          Daybreak provides general wellness, planning, fitness, and nutrition information. It is
          not a medical device and does not provide diagnosis, treatment, prevention, cure, clinical
          measurement, psychotherapy, or medication advice. It does not replace a physician,
          therapist, registered dietitian, or other qualified professional.
        </p>
      </LegalSection>
      <LegalSection title="Not for emergencies">
        <p>
          Do not use Daybreak for urgent or life-threatening situations. If you or another person
          may be in immediate danger, contact local emergency services now. Daybreak cannot contact
          them for you and does not monitor accounts for emergencies.
        </p>
      </LegalSection>
      <LegalSection title="Measurements and AI output">
        <p>
          Connected-device measurements can be incomplete, delayed, inconsistent, or inaccurate.
          Daybreak keeps source and confidence information and does not present AI-generated values
          as sensor measurements. AI output can be incomplete, inaccurate, biased, or inappropriate.
          Never start, stop, or change medication or treatment based on Daybreak. Consult a
          qualified professional before decisions affecting health or safety.
        </p>
      </LegalSection>
      <LegalSection title="No guaranteed outcome">
        <p>
          Daybreak does not guarantee improved sleep, fitness, nutrition, productivity, mental
          wellness, or any other result. Use your judgment, stop an activity that feels unsafe, and
          seek professional help for concerns.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
