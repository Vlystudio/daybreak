-- Bird houses. Players buy house types (stored in user_inventory like other
-- items) and equip one as the active house, shown in the nest by day; at night
-- the companion sleeps inside it. The equipped house key lives on user_game.

alter table public.user_game add column if not exists bird_house text;
