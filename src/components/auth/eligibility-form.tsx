"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeAdultEligibility, reportCurrentAccountUnder18 } from "@/actions/eligibility";

export function EligibilityForm() {
  const [adultAttested, setAdultAttested] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();

  function continueAccount() {
    startTransition(async () => {
      const result = await completeAdultEligibility({
        adultAttested,
        acceptedTerms,
        privacyAcknowledged,
      });
      if (result?.ok === false) toast.error(result.error);
    });
  }

  function reportUnder18() {
    startTransition(async () => {
      const result = await reportCurrentAccountUnder18();
      if (result?.ok === false) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          id="eligibility-adult-attestation"
          data-testid="eligibility-adult-attestation"
          className="mt-1 h-4 w-4"
          checked={adultAttested}
          onChange={(event) => setAdultAttested(event.target.checked)}
        />
        <span>I confirm that I am at least 18 years old and legally eligible to use Daybreak.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          id="eligibility-terms-acceptance"
          data-testid="eligibility-terms-acceptance"
          className="mt-1 h-4 w-4"
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
        />
        <span>
          I accept the current{" "}
          <Link className="text-primary underline" href="/terms" target="_blank">
            Terms of Service
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          id="eligibility-privacy-acknowledgment"
          data-testid="eligibility-privacy-acknowledgment"
          className="mt-1 h-4 w-4"
          checked={privacyAcknowledged}
          onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
        />
        <span>
          I acknowledge the current{" "}
          <Link className="text-primary underline" href="/privacy" target="_blank">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <Button
        className="w-full"
        id="eligibility-confirm"
        data-testid="eligibility-confirm"
        disabled={pending || !adultAttested || !acceptedTerms || !privacyAcknowledged}
        onClick={continueAccount}
      >
        {pending ? "Saving…" : "Confirm and continue"}
      </Button>
      <Button
        className="w-full"
        id="eligibility-under-18"
        data-testid="eligibility-under-18"
        variant="ghost"
        disabled={pending}
        onClick={reportUnder18}
      >
        I am under 18
      </Button>
      <p className="text-muted-foreground text-xs">
        Daybreak is available only to adults. Selecting “I am under 18” restricts this account,
        disconnects integrations, stops AI processing, signs it out, and starts deletion.
      </p>
    </div>
  );
}
