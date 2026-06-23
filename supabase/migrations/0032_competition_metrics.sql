-- Broaden challenges beyond Oura step/calorie races: also compete on habit
-- completions and protein intake, scored from habit_logs and food_logs.

alter table public.competitions drop constraint competitions_metric_check;
alter table public.competitions
  add constraint competitions_metric_check
  check (metric in ('steps', 'active_calories', 'habits', 'protein'));
