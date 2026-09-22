# Production environment validation

`npm run release:verify-production` is the fail-closed gate used before an Apple archive is built. It validates the exact reviewed app origin and Supabase project, required legal identity configuration, core secrets, processor approvals, AI-provider approvals, owners, evidence references, review dates, and the environment variables required by approved integrations.

The validator never prints or stores a credential value. Its sanitized result is written to `build/release-evidence/production-environment.sanitized.json`. A missing or placeholder setting, an unapproved provider, an expired review, or a mismatched production URL exits with status 2.

Approval fields must be updated only after the owner has completed the corresponding external review and stored the non-secret evidence reference. Credentials belong in the Codemagic `appstore` encrypted environment group; they must not be committed. Re-run the validator whenever a provider, legal identity, endpoint, credential, contract, or review date changes.
