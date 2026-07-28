# Data-flow and consumer-health inventory

The generated, field-level data-flow register is
`docs/privacy/data-flow-inventory.md`, sourced from
`config/privacy/data-inventory.json`. It records source, destination, purpose,
storage, identity linkage, tracking, health sensitivity, consent, and processor.

Consumer-health categories include sleep, activity, workouts, heart rate, HRV,
recovery/readiness, energy, body measurements/composition, nutrition, hydration,
mood, stress, soreness, health check-ins, provenance/confidence, and derived
wellness interpretations. Sources are Apple Health, Oura, Fitbit, manual entry,
and user-selected uploads. HealthKit requests read access only; Daybreak does not
write AI-generated or fabricated measurements to HealthKit.

Health data is used to display trends, identify source conflicts/quality, adapt
general wellness plans, and answer user-requested check-ins. It is prohibited
from advertising, cross-context tracking, marketing profiles, non-sensitive
analytics, crash content, session replay, email, and lock-screen notification
content. OpenAI may receive minimized health context only when current basic and
health AI categories are both active. LogMeal is not sent health records, though
a user-selected meal image may itself be sensitive.

Counsel must map the exact launch jurisdictions to consumer-health statutes,
authorization/consent form requirements, sale/share definitions, geofencing or
registration duties, appeal/response deadlines, and processor contracts. The
app must not claim HIPAA compliance or covered-entity status absent a documented
factual/legal determination.
