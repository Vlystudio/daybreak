import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Copyright and Intellectual Property" };

export default function CopyrightPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage
      title="Copyright and Intellectual Property"
      effectiveDate={identity.termsEffectiveDate}
    >
      <LegalSection title="Daybreak materials">
        <p>
          Copyright © 2026 {identity.copyrightOwner}. Daybreak software, design, text, branding, and
          first-party visual assets are protected by applicable intellectual-property laws. No right
          is granted except the limited right to use the service under the Terms.
        </p>
      </LegalSection>
      <LegalSection title="Your content and third-party materials">
        <p>
          Users retain ownership of content they provide. The limited operating license is described
          in the Terms and Privacy Policy. Open-source software and third-party assets remain under
          their respective licenses and notices in THIRD_PARTY_NOTICES. Provider names and marks
          belong to their owners and do not imply endorsement.
        </p>
      </LegalSection>
      <LegalSection title="Copyright concerns">
        <p>
          Send a sufficiently detailed notice to {identity.supportEmail}, including the work,
          allegedly infringing material, location, contact details, good-faith statement, and
          authority to act. Daybreak will review notices and counter-notices under applicable law.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
