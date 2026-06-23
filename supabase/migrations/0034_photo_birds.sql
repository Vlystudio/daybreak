-- Photo birds: a user can photograph a real bird and keep it as a collectible.
-- Such a bird has no catalog species — its name, fun-fact, and colors come from
-- vision identification and live on the row itself.

alter table public.user_birds alter column species_key drop not null;

alter table public.user_birds
  add column if not exists source text not null default 'hatched' check (source in ('hatched', 'photo')),
  add column if not exists custom_name text check (char_length(custom_name) <= 80),
  add column if not exists custom_blurb text check (char_length(custom_blurb) <= 300),
  add column if not exists custom_palette jsonb,
  add column if not exists custom_crest boolean,
  add column if not exists custom_long_tail boolean;
