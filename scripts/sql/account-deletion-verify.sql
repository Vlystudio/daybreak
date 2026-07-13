\if :{?user_id}
\else
\echo 'ERROR: pass -v user_id=<synthetic-staging-uuid>'
\quit 2
\endif

-- Read-only residue report for a synthetic staging account.
-- This script is deliberately outside supabase/tests so it never runs during reset.
BEGIN READ ONLY;

SELECT 'auth.users' AS resource, count(*) AS matching_rows
FROM auth.users WHERE id = :'user_id'::uuid
UNION ALL SELECT 'profiles', count(*) FROM public.profiles WHERE id = :'user_id'::uuid
UNION ALL SELECT 'user_preferences', count(*) FROM public.user_preferences WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'health_metrics', count(*) FROM public.health_metrics WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'daily_summaries', count(*) FROM public.daily_summaries WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'schedule_events', count(*) FROM public.schedule_events WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'calendar_sync_settings', count(*) FROM public.calendar_sync_settings WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'subjective_checkins', count(*) FROM public.subjective_checkins WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'health_checkins', count(*) FROM public.health_checkins WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'food_logs', count(*) FROM public.food_logs WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'water_logs', count(*) FROM public.water_logs WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'body_measurements', count(*) FROM public.body_measurements WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'evening_reviews', count(*) FROM public.evening_reviews WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'habits', count(*) FROM public.habits WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'habit_logs', count(*) FROM public.habit_logs WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'goals', count(*) FROM public.goals WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'reminders', count(*) FROM public.reminders WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'health_workouts', count(*) FROM public.health_workouts WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'health_daily_samples', count(*) FROM public.health_daily_samples WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'apple_health_imports', count(*) FROM public.apple_health_imports WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'health_observations', count(*) FROM public.health_observations WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'fitness_plans', count(*) FROM public.fitness_plans WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_equipment', count(*) FROM public.user_equipment WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_limitations', count(*) FROM public.user_limitations WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_workouts', count(*) FROM public.user_workouts WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_workout_logs', count(*) FROM public.user_workout_logs WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'grocery_items', count(*) FROM public.grocery_items WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'recipe_feedback', count(*) FROM public.recipe_feedback WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_stores', count(*) FROM public.user_stores WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'pantry_items', count(*) FROM public.pantry_items WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'meal_plans', count(*) FROM public.meal_plans WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'meal_plan_days', count(*) FROM public.meal_plan_days AS d JOIN public.meal_plans AS p ON p.id = d.meal_plan_id WHERE p.user_id = :'user_id'::uuid
UNION ALL SELECT 'shopping_lists', count(*) FROM public.shopping_lists WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'shopping_list_items', count(*) FROM public.shopping_list_items AS i JOIN public.shopping_lists AS l ON l.id = i.shopping_list_id WHERE l.user_id = :'user_id'::uuid
UNION ALL SELECT 'grocery_settings', count(*) FROM public.grocery_settings WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'nutrition_goals', count(*) FROM public.nutrition_goals WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'grocery_purchases', count(*) FROM public.grocery_purchases WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'friend_settings', count(*) FROM public.friend_settings WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'friendships_both_sides', count(*) FROM public.friendships WHERE requester_id = :'user_id'::uuid OR addressee_id = :'user_id'::uuid
UNION ALL SELECT 'competitions_created', count(*) FROM public.competitions WHERE creator_id = :'user_id'::uuid
UNION ALL SELECT 'competition_participants', count(*) FROM public.competition_participants WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'nudges_both_sides', count(*) FROM public.nudges WHERE from_user_id = :'user_id'::uuid OR to_user_id = :'user_id'::uuid
UNION ALL SELECT 'households_owned', count(*) FROM public.households WHERE owner_id = :'user_id'::uuid
UNION ALL SELECT 'household_members', count(*) FROM public.household_members WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_birds', count(*) FROM public.user_birds WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_game', count(*) FROM public.user_game WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'reward_ledger', count(*) FROM public.reward_ledger WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_inventory', count(*) FROM public.user_inventory WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'user_eggs', count(*) FROM public.user_eggs WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'oauth_connections', count(*) FROM public.oauth_connections WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'notification_settings', count(*) FROM public.notification_settings WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'push_subscriptions', count(*) FROM public.push_subscriptions WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'analytics_events', count(*) FROM public.analytics_events WHERE user_id = :'user_id'::uuid
UNION ALL SELECT 'rate_limits', count(*) FROM public.rate_limits WHERE key LIKE '%' || :'user_id' || '%'
UNION ALL SELECT 'recipes_created_by', count(*) FROM public.recipes WHERE created_by = :'user_id'::uuid
UNION ALL SELECT 'recipe_ingredients_created_by', count(*) FROM public.recipe_ingredients AS i JOIN public.recipes AS r ON r.id = i.recipe_id WHERE r.created_by = :'user_id'::uuid
UNION ALL SELECT 'product_prices_recorded_by', count(*) FROM public.product_prices WHERE recorded_by = :'user_id'::uuid
UNION ALL SELECT 'products_created_by', count(*) FROM public.products WHERE created_by = :'user_id'::uuid
UNION ALL SELECT 'ai_generation_cache_all_rows', count(*) FROM public.ai_generation_cache
UNION ALL SELECT 'storage_objects_addressed', count(*)
FROM storage.objects
WHERE name = :'user_id'
   OR name LIKE :'user_id' || '/%'
   OR name LIKE 'users/' || :'user_id' || '/%'
   OR name IN (
     :'user_id' || '.jpg', :'user_id' || '.jpeg', :'user_id' || '.png',
     :'user_id' || '.webp', :'user_id' || '.zip', :'user_id' || '.json'
   )
ORDER BY resource;

COMMIT;
