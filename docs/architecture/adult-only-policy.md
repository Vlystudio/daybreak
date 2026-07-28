# Adult-only enrollment and account policy

Daybreak V1 is an adult-only service. A person must be at least 18 years old and must make a
current, affirmative self-attestation before an account may be created or an existing account may
enter protected application routes. The attestation is an eligibility statement, not parental
consent or age verification. Daybreak does not offer a child or teen account path.

## Enrollment invariant

The signup form leaves the adult-attestation control unchecked. The server action accepts signup
only when the exact current attestation and legal-document versions are supplied. The database Auth
trigger independently rejects a newly created email, OAuth, or other-provider identity unless the
same current metadata is present in that Auth transaction. Older clients and direct Auth API calls
therefore cannot bypass the policy.

Daybreak does not collect birth year during normal enrollment. A person who states that they are
under 18 is shown a neutral rejection and no account-creation request is sent. Tests must not infer
age from health data, profile text, or another proxy.

## Existing accounts

Every protected request and server-side user gate checks account status, current adult attestation,
and current required legal acceptance. An existing account missing any requirement is routed to the
eligibility screen. Acceptance records are append-only, versioned, time-stamped, and tied to the
authenticated user. A document-version change requires reacceptance before access resumes.

## Actual knowledge of a minor

Support must follow `docs/operations/minor-account-response.md`. The authenticated administrative
workflow is dry-run by default and requires an explicit write flag. It atomically restricts the
account, revokes consent and synchronization, queues durable deletion, and minimizes historical
birth-year data. The deletion worker revokes remote provider grants before removing local tokens and
deletes the Auth identity last. Transient provider failure leaves the account restricted and queued
for retry; it never restores application access.

Audit events record the action and deletion outcome without the person's identifier or health data
in metadata. Operators must not copy allegations, birth dates, identity documents, or health values
into tickets or logs. Any evidence needed for a legal hold requires counsel-approved handling outside
ordinary application storage.

## Enforcement and evidence

- UI/server: `src/components/auth/auth-form.tsx`, `src/actions/auth.ts`,
  `src/actions/eligibility.ts`, and `src/lib/auth.ts`.
- Request gate: `src/proxy.ts`.
- Database: `supabase/migrations/0049_adult_eligibility_and_legal_acceptance.sql` and
  `supabase/migrations/0053_birth_year_data_minimization.sql`.
- Minor response: `src/app/api/admin/restrict-minor/route.ts` and
  `docs/operations/minor-account-response.md`.
- Tests: `src/lib/account-eligibility.test.ts` and
  `supabase/tests/adult_eligibility_test.sql`.

This repository can prove the enforcement design and automated checks. It cannot substitute for
counsel's launch-jurisdiction review of age-assurance duties, consumer-health law, record handling,
or the incident process; that approval remains a blocking external gate.
