import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, LegalList } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Legal documents" };

const documents = [
  ["Privacy Policy", "/privacy"],
  ["Terms of Service", "/terms"],
  ["Consumer Health Data Privacy Policy", "/legal/consumer-health-privacy"],
  ["Health and Medical Disclaimer", "/legal/health-disclaimer"],
  ["AI Processing and Output Disclosure", "/legal/ai"],
  ["Acceptable Use Policy", "/legal/acceptable-use"],
  ["Retention and Deletion", "/legal/retention"],
  ["Copyright and Intellectual Property", "/legal/copyright"],
  ["Security and Vulnerability Reporting", "/security"],
] as const;

export default function LegalIndexPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage title="Legal documents" effectiveDate={identity.termsEffectiveDate}>
      <p>Current public documents for Daybreak are available without an account.</p>
      <LegalList>
        {documents.map(([label, href]) => (
          <li key={href}>
            <Link className="text-primary underline" href={href}>
              {label}
            </Link>
          </li>
        ))}
      </LegalList>
    </LegalPage>
  );
}
