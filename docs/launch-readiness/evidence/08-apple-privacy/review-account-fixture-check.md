# Synthetic review-account preferences

September 22, 2026. Visual review of actual simulator captures showed that the
synthetic account's work-day buttons were unselected despite work times being
present. Its initial fixture had stored numeric work days, while the production
form expects weekday names.

Corrected only this dedicated account's `user_preferences.work_days` to Monday
through Friday. The script checked the locally retained synthetic-account purpose,
signed in with the ordinary publishable client, checked the authenticated user ID
and synthetic marker, scoped the update to that user, and read back the result.
It used a local-scope logout so other test sessions were not invalidated. No service
role, account bypass, schema change, personal account, or provider data was involved.

Credentials and the private account ID remain in the ignored build directory and
Apple's private review fields. This correction does not change the four uploaded
store screenshots, which show Today, Schedule, Check-in and Connections.

Final simulator run `35790969516` signed in through the ordinary UI and captured
the corrected Monday–Friday selection. An independent authenticated HTTP read of
the live preferences page also passed. These checks used local-scope logout where
applicable; no other test or owner session was globally revoked.
