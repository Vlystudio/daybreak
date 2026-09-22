import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = { title: "Retention and Deletion" };

const rows = [
  [
    "Account, profile, tasks, plans, calendar mirrors, health and user content",
    "While the account is active",
    "Removed by user action, disconnect-with-deletion, or account deletion",
  ],
  [
    "OAuth, push, and notification credentials",
    "While connected or subscribed",
    "Revoked/removed on disconnect or account deletion",
  ],
  [
    "AI permits",
    "Two-minute authorization; expired records cleaned after one hour",
    "Automated daily retention job",
  ],
  [
    "AI cache",
    "No more than two hours",
    "Automated daily retention job and immediate consent-change purge",
  ],
  ["Rate-limit records", "Up to two days", "Automated daily retention job"],
  [
    "Product analytics",
    "Up to 365 days",
    "Automated daily retention job; no health or sensitive content",
  ],
  [
    "Anonymous audit/security events",
    "Up to 365 days after account linkage is removed",
    "Automated daily retention job unless a narrow legal/security hold applies",
  ],
  ["Deletion status receipt", "45 days", "Automatic expiry; contains no raw user identifier"],
  [
    "Rights and support workflow",
    "While the account exists and as required to complete or evidence the request",
    "Account deletion or approved legal schedule",
  ],
  [
    "Backups",
    "Provider-configured recovery lifecycle",
    "Expires through backup rotation; not returned to active use except permitted recovery/security/legal needs",
  ],
] as const;

export default function RetentionPage() {
  const identity = getLegalIdentity();
  return (
    <LegalPage title="Data Retention and Deletion" effectiveDate={identity.privacyEffectiveDate}>
      <p>
        Daybreak minimizes retention by category. Exact provider backup and support-record periods
        are production release gates and must be confirmed in executed provider terms before launch.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="border p-2">Category</th>
              <th className="border p-2">Retention</th>
              <th className="border p-2">Deletion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([category, retention, deletion]) => (
              <tr key={category}>
                <td className="border p-2 font-medium">{category}</td>
                <td className="border p-2">{retention}</td>
                <td className="border p-2">{deletion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LegalSection title="Account deletion">
        <p>
          Settings provides deletion after reauthentication. Daybreak immediately restricts the
          account, invalidates AI authorization, signs out sessions, and queues a durable worker
          that revokes connected providers before deleting credentials, storage, user rows,
          generated and derived records, then the authentication identity. Transient provider
          failures retry with backoff; permanent failure is shown as blocked rather than falsely
          completed. An opaque status capability works after authentication deletion and expires
          after 45 days.
        </p>
      </LegalSection>
      <LegalSection title="Exceptions and verification">
        <p>
          Narrow records may be retained where law, fraud prevention, dispute preservation, or
          security response requires it. Holds must be authorized and scoped; they do not permit
          product use of deleted content. Retention automation supports dry-run reporting and
          records category counts without personal values. Contact {identity.privacyEmail} for
          questions.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
