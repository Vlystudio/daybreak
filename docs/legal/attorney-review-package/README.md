# Daybreak attorney review package

Status: **not reviewed or approved by counsel**. This package organizes the
technical record for qualified counsel; it is not legal advice and no checkbox
may be completed by software.

Review the exact rendered release candidate together with the canonical source
files listed in `public-documents.md`. The shared legal identity intentionally
fails a production build when any operator/contact/date/jurisdiction value is
missing or placeholder-like. Confidential contracts, legal advice, and personal
contact evidence should remain in approved secure storage; commit only a
non-secret decision reference.

## Contents

- `public-documents.md` — exact routes, source, versions, and review scope for every public legal document.
- `technical-implementation-summary.md` — controls behind factual policy statements.
- `data-and-health-inventory.md` — data flows and consumer-health processing.
- `providers-and-processors.md` — AI, infrastructure, and integration registers.
- `retention-and-deletion.md` — retention jobs, deletion state machine, and backup caveat.
- `adult-and-minor-policy.md` — adult self-attestation and known-minor response.
- `launch-jurisdiction-checklist.md` — decisions that depend on launch location and business facts.
- `attorney-questions.md` — focused questions requiring counsel.
- `signoff-matrix.md` — versioned approval record template.
- `technical-consistency-audit.md` — engineering consistency findings and remaining evidence gates.

Supporting generated records are linked rather than duplicated so regeneration
cannot silently leave counsel reviewing stale text.
