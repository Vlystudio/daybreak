# Account deletion inventory and operator verification

## Behavior and retry model

The server-side deletion action runs authenticated administrative steps in this order:

1. Remove user-addressed objects from every Supabase Storage bucket.
2. Remove OAuth credentials, push subscriptions, and notification settings.
3. Remove social and household relationships.
4. Remove records whose foreign keys would otherwise be retained or anonymized.
5. Delete the Supabase Auth user last.

The process is intentionally retryable before the final step: deletes are idempotent, missing storage objects are harmless, and the Auth identity remains available if an earlier step fails. The sequence is not one database transaction because it spans Storage, PostgREST, and Auth APIs. If the Auth deletion succeeds, cascading foreign keys complete the database deletion and the operation is irreversible from the application. A backup may retain data according to the infrastructure retention policy; it must not be restored selectively as an active user account without legal and security approval.

The API returns only a generic failure while server logs identify the named step without logging the user ID or payload. Never log the user's access token, OAuth tokens, health payloads, or exported data.

## Data inventory

| Area                              | Resources                                                                                                                                                                                                         | Deletion mechanism                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and preferences          | `auth.users`, `profiles`, `user_preferences` (including AI consent), `calendar_sync_settings`                                                                                                                     | Auth is deleted last; public rows cascade from `auth.users`.                                                                                                                                                                                                                                                  |
| Core health and planning          | `health_metrics`, `daily_summaries`, `schedule_events`, `subjective_checkins`, `health_checkins`, `food_logs`, `water_logs`, `body_measurements`, `evening_reviews`, `habits`, `habit_logs`, `goals`, `reminders` | Direct `user_id` foreign keys cascade. Habit logs also cascade through habits.                                                                                                                                                                                                                                |
| Apple Health                      | `health_workouts`, `health_daily_samples`, `apple_health_imports`, `health_observations`                                                                                                                          | Direct `user_id` foreign keys cascade. Disconnecting HealthKit alone stops future access but is not account deletion.                                                                                                                                                                                         |
| Fitness                           | `fitness_plans`, `user_equipment`, `user_limitations`, `user_workouts`, `user_workout_logs`                                                                                                                       | Direct `user_id` foreign keys cascade.                                                                                                                                                                                                                                                                        |
| Grocery and nutrition             | `grocery_items`, `recipe_feedback`, `user_stores`, `pantry_items`, `meal_plans`, `meal_plan_days`, `shopping_lists`, `shopping_list_items`, `grocery_settings`, `nutrition_goals`, `grocery_purchases`            | User-owned roots cascade; child rows cascade from their roots. Household links on shared catalog records are cleared by household deletion.                                                                                                                                                                   |
| Social and shared data            | `friend_settings`, `friendships`, `competitions`, `competition_participants`, `nudges`, `households`, `household_members`                                                                                         | Explicit cleanup runs before Auth deletion for both sides of two-user relationships and owned shared roots; cascades are a backstop. Deleting an owned household also removes its memberships and clears nullable household references.                                                                       |
| Game data                         | `user_birds`, `user_game`, `reward_ledger`, `user_inventory`, `user_eggs`                                                                                                                                         | Direct `user_id` foreign keys cascade.                                                                                                                                                                                                                                                                        |
| Credentials and messaging         | `oauth_connections`, `notification_settings`, `push_subscriptions`                                                                                                                                                | Explicit deletion before Auth, then cascade as a backstop. This removes stored provider tokens, push endpoints, and notification configuration. Provider-side OAuth revocation is not implemented; token removal prevents further Daybreak use, and provider retention/revocation must be checked separately. |
| Audit and analytics               | `audit_logs`, `analytics_events`                                                                                                                                                                                  | These foreign keys use `ON DELETE SET NULL`, so the implementation explicitly deletes matching rows first instead of retaining identifiable payload/metadata.                                                                                                                                                 |
| Rate limiting                     | `rate_limits`                                                                                                                                                                                                     | The service key may embed the UUID and has no foreign key. Keys containing the exact UUID are explicitly deleted.                                                                                                                                                                                             |
| User-contributed catalog          | `recipes.created_by`, `product_prices.recorded_by`, `products.created_by`                                                                                                                                         | Matching recipes and price observations are explicitly deleted. Product creator attribution is explicitly set to null so shared catalog integrity remains without an identifier.                                                                                                                              |
| Legacy AI cache                   | `ai_generation_cache`                                                                                                                                                                                             | This service-only table has no user key, so individual payloads cannot be attributed safely. Current application code does not use it; deletion purges the whole legacy cache rather than retaining possibly personal prompts.                                                                                |
| Supabase Storage                  | Every bucket: `<user-id>/...`, `users/<user-id>/...`, and root `<user-id>.{jpg,jpeg,png,webp,zip,json}`                                                                                                           | Recursive explicit deletion before Auth. Current avatar uploads use `avatars/<user-id>/<uuid>.<ext>` and are covered. New upload paths must follow one of these addressable patterns or update the deletion code and this inventory.                                                                          |
| Account export                    | Browser-generated JSON/ZIP object URL                                                                                                                                                                             | The export is transient in the requesting browser and is revoked after download; no durable server export job or export table exists. Local downloaded copies are controlled by the user and cannot be remotely deleted.                                                                                      |
| Email delivery and scheduled work | Auth email address, Resend delivery, cron endpoints                                                                                                                                                               | The repository has no separate email-recipient or durable job-queue table. Auth deletion removes the source address. Provider delivery/event retention and platform logs must be verified under the applicable Resend/Vercel contracts.                                                                       |
| Observability and backups         | Vercel logs, Sentry events if configured, Supabase logs/backups                                                                                                                                                   | Not addressable through the in-app deletion transaction. Production owners must verify retention, redaction, deletion/export procedures, and legal exceptions with each provider. Secrets and health payloads must not be logged.                                                                             |
| Reference-only catalogs           | `exercises`, stores/locations, ingredients, products, price sources, recipe ingredients, substitutions                                                                                                            | These are not inherently user accounts. Only the user-attribution fields listed above are removed; shared reference data remains.                                                                                                                                                                             |

## Pre-release code checks

Run from the exact release commit:

```bash
npx vitest run src/lib/account-deletion.test.ts
rg -n "references auth\.users|user_id|created_by|recorded_by|requester_id|addressee_id|from_user_id|to_user_id" supabase/migrations
rg -n "storage\.from|\.upload\(" src
```

Review every newly discovered table, identifier column, external provider, and upload path against this inventory. The unit test asserts the real deletion plan includes the non-cascading stores and keeps Auth last; it does not substitute for an integration deletion test.

## Exact staging integration procedure

Use a synthetic staging account containing data in every feature area, at least one avatar, a push subscription, a provider connection, a friendship, a competition, and an owned household. Never use a production user for this exercise.

1. Create a unique synthetic user through the staging sign-up flow and verify its email. Record its UUID only in the private test record.
2. Use the staging UI/API to create a profile, AI-consent decision, check-in, calendar event, health metric/observation, Apple Health fixture, meal/receipt analysis, workout, grocery/list item, game record, and notification preference.
3. Upload an avatar and, using an administrator-only staging tool, add harmless fixture objects under `<uuid>/`, `users/<uuid>/`, and `<uuid>.json` in two different buckets.
4. With a second synthetic user, create both friendship directions where supported, a nudge, competition participation, and household membership. Connect only disposable OAuth provider accounts and a disposable push subscription.
5. Run the residue SQL below and retain the **before** counts. Independently list addressed Storage objects and provider connections without printing token values.
6. Trigger deletion through **Settings → Data & privacy**, type `DELETE`, and submit the authenticated flow. Do not delete `auth.users` directly.
7. Run the residue SQL again. Every user-addressed count, Auth row, relationship, retained reference, cache, and Storage count must be zero; unrelated second-user/reference rows must remain.
8. Confirm refresh/login fails for the deleted identity, the second user cannot access a former shared relationship, and no scheduled notification or provider sync succeeds.
9. Confirm addressed objects are absent from every Storage bucket using the Supabase dashboard or a service-role staging script that prints paths only, never signed URLs.
10. Confirm the disposable OAuth connections are absent locally. Where the provider exposes an account dashboard/revocation endpoint, confirm the grant is revoked or manually revoke it and record the result; local deletion alone does not prove provider erasure.
11. Exercise retry behavior separately: temporarily make the **staging-only** Storage API unreachable, submit deletion, confirm the generic error and that Auth remains, restore Storage, retry, and verify complete deletion. Do not perform this fault injection in production.

Run the read-only verification script before deletion and save its counts:

```bash
read -r -p "Synthetic staging user UUID: " DELETION_TEST_USER_ID
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v user_id="$DELETION_TEST_USER_ID" \
  -f scripts/sql/account-deletion-verify.sql
```

Trigger deletion through the authenticated application flow, not by directly deleting `auth.users`. Then run the exact same command again. After deletion:

- `auth.users`, all direct/cascading rows, both sides of relationships, retained-reference rows, rate-limit keys, and addressed storage objects must report zero.
- `products_created_by` must report zero because attribution was nulled.
- `ai_generation_cache_all_rows` must report zero under the current privacy-safe purge policy.
- Shared reference catalogs and records belonging only to other synthetic users must remain.
- A login/refresh attempt for the deleted identity must fail, and retrying the deletion endpoint must not expose account existence.

The SQL script does not inspect external processors. Record separate evidence for Supabase backup retention, Vercel/Sentry log policy, Resend retention, provider-side OAuth grants, Apple authorization behavior, and any support-system exports.

## Failure handling and release stop conditions

- If a pre-Auth step fails, do not manually delete Auth. Correct the dependency or permission, then retry the full operation.
- If Auth deletion fails, retry; the preceding deletes are safe to repeat.
- If Auth succeeds but verification finds live data, treat it as a privacy incident candidate, preserve minimal evidence, restrict access, and escalate to the privacy/security owner.
- Block release if any user-linked table, storage convention, cache, processor, backup, log, or queue lacks an owner and a verified disposition.
- Re-run the inventory and staging test whenever migrations, storage uploads, analytics, AI persistence, notifications, email, or observability change.
