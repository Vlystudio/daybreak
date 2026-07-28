# AI consent and egress architecture

Eight independent, unchecked categories are stored under version `2026-07-28`: basic, tasks, check-in, health, calendar availability, calendar detail, profile, and uploads. Decisions expire after 180 days. Calendar detail depends on availability; every sensitive category also requires basic processing.

An authenticated server feature requests an opaque in-process permit for an exact user, purpose, and category set. A service-only database RPC rechecks eligibility, current version, expiry, category flags, and consent epoch, then stores only a nonce hash with two-minute expiry and bounded use count. Each outbound request consumes the permit atomically; wrong user, purpose, categories, nonce, epoch, replay budget, restriction, deletion, or expiry fails closed.

OpenAI traffic has a fixed origin, size/timeout/retry bounds, registered provider, safe operational logging, and schema-validated output. LogMeal requires the same permit consumption. Revocation increments the epoch, deletes permits, purges cached context, records immutable history, and prevents queued retry reuse. Production providers remain disabled until the registry records approval, owner, contract/DPA, region, retention, training, security review, and evidence.
