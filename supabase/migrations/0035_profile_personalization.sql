-- Profile personalization: a chosen accent theme. And a per-habit weekly target
-- so the habit builder can track progress toward a real goal (not just /7).

alter table public.profiles
  add column if not exists accent text not null default 'sunrise'
  check (accent in ('sunrise', 'coral', 'berry', 'grape', 'ocean', 'forest'));

alter table public.habits
  add column if not exists target_per_week smallint not null default 7
  check (target_per_week between 1 and 7);
