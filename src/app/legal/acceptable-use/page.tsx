import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Acceptable Use Policy" };

export default function AcceptableUsePage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage title="Acceptable Use Policy" effectiveDate={identity.termsEffectiveDate}>
      <LegalSection title="Do not use Daybreak to">
        <LegalList>
          <li>break law, violate intellectual-property or privacy rights, or facilitate harm;</li>
          <li>access, infer, expose, or modify another person&apos;s account or information;</li>
          <li>
            evade adult eligibility, consent, authorization, rate-limit, or deletion controls;
          </li>
          <li>
            upload malware, exploit vulnerabilities, disrupt service, scrape, spam, or automate
            abuse;
          </li>
          <li>
            submit content you lack authority to process or expose another person&apos;s health
            data;
          </li>
          <li>
            use the service for diagnosis, clinical treatment, medication dosing, or emergency
            response;
          </li>
          <li>
            misrepresent AI output as verified fact, professional advice, or measured health data;
            or
          </li>
          <li>reverse engineer or resell the service except where law expressly permits.</li>
        </LegalList>
      </LegalSection>
      <LegalSection title="Enforcement">
        <p>
          Daybreak may rate-limit, restrict, suspend, investigate, preserve narrowly necessary
          evidence, or terminate use proportionately. Mandatory legal and consumer rights remain
          available. Report security issues through the Security page rather than exploiting them.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
