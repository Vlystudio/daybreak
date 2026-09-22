import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Security and Vulnerability Reporting" };

export default function SecurityPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage
      title="Security and Vulnerability Reporting"
      effectiveDate={identity.privacyEffectiveDate}
    >
      <LegalSection title="Report a vulnerability">
        <p>
          Email{" "}
          <a className="text-primary underline" href={`mailto:${identity.securityEmail}`}>
            {identity.securityEmail}
          </a>
          . Do not include real health information, credentials, tokens, or another person&apos;s
          data. Reports should describe the affected component, reproducible steps using synthetic
          data, impact, and safe contact information.
        </p>
      </LegalSection>
      <LegalSection title="Safe research expectations">
        <LegalList>
          <li>Use your own account and synthetic data; stop if personal information is exposed.</li>
          <li>
            Do not disrupt service, use social engineering, persist access, or exfiltrate data.
          </li>
          <li>Give Daybreak reasonable time to investigate before disclosure.</li>
          <li>Do not demand payment or threaten disclosure.</li>
        </LegalList>
      </LegalSection>
      <LegalSection title="What to expect">
        <p>
          Daybreak will acknowledge and triage reports as operational capacity permits, contain
          verified issues, preserve minimized evidence, and coordinate remediation. This page does
          not promise that the service is fully secure or create a bounty. Legal breach
          notifications require authorized human and legal review; they are never sent automatically
          by software.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
