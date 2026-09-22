import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage title="Daybreak support" effectiveDate={identity.privacyEffectiveDate}>
      <LegalSection title="Get help">
        <p>
          For help with your account, planning or connected health sources, email{" "}
          <a className="text-primary underline" href={`mailto:${identity.supportEmail}`}>
            {identity.supportEmail}
          </a>
          . Include what you were trying to do, your device and the app version if available. Please
          do not send passwords, verification codes or health records.
        </p>
      </LegalSection>
      <LegalSection title="Your information">
        <p>
          You can export your data, disconnect a provider or request account deletion in{" "}
          <Link className="text-primary underline" href="/settings#data-privacy">
            Settings → Data &amp; privacy
          </Link>
          . If you cannot sign in, contact us at{" "}
          <a className="text-primary underline" href={`mailto:${identity.privacyEmail}`}>
            {identity.privacyEmail}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title="Policies and security">
        <p>
          Read the{" "}
          <Link className="text-primary underline" href="/privacy">
            Privacy Policy
          </Link>
          ,{" "}
          <Link className="text-primary underline" href="/terms">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link className="text-primary underline" href="/security">
            security reporting guidance
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
