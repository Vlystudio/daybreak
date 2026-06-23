-- Starter-egg ceremony: new users keep two of four eggs and hatch one. We track
-- whether the ceremony is done and how many free hatches (the reserved egg) the
-- user has banked.

alter table public.user_game
  add column if not exists starter_done boolean not null default false,
  add column if not exists free_hatches integer not null default 0 check (free_hatches >= 0);
