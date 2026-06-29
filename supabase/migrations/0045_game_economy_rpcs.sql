-- Atomic game-economy state transitions.
--
-- The TypeScript actions previously read the seed balance, mutated birds, then
-- wrote `seeds = balance ± amount` — a read-modify-write that loses updates and
-- can overspend under concurrent requests (double-tap, two devices). These
-- functions move every balance change into the database behind a
-- `SELECT ... FOR UPDATE` lock on the user's wallet row, validate ownership and
-- the active/last-bird rules in-DB, and compute sell value from a trusted
-- server mapping — never from client input.
--
-- They run as SECURITY INVOKER (default) and are EXECUTE-revoked from
-- public/anon/authenticated: only the service-role server actions (which derive
-- p_user_id from the authenticated session) may call them. search_path is pinned.

-- Store each bird's rarity so sell value is computed from data, not re-derived.
alter table public.user_birds add column if not exists rarity text;

-- Trusted rarity -> sell value mapping (mirror of RARITY_META.sellValue in
-- src/lib/game/birds.ts — keep the two in sync; a vitest guard checks parity).
create or replace function public.bird_sell_value(p_rarity text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(coalesce(p_rarity, ''))
    when 'common' then 10
    when 'uncommon' then 25
    when 'rare' then 75
    when 'epic' then 200
    when 'legendary' then 500
    when 'wild' then 50
    else 10
  end;
$$;

-- Hatch: spend a banked free egg or `p_cost` seeds, insert the bird, adopt it as
-- the companion if there isn't one. All under the wallet lock.
create or replace function public.hatch_egg_for_user(
  p_user_id uuid, p_species_key text, p_rarity text, p_cost integer
)
returns table (bird_id uuid, used_free boolean, seeds integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_seeds integer;
  v_free integer;
  v_active uuid;
  v_use_free boolean;
  v_bird uuid;
begin
  insert into public.user_game (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  select g.seeds, g.free_hatches, g.active_bird_id
    into v_seeds, v_free, v_active
    from public.user_game g where g.user_id = p_user_id for update;

  v_use_free := coalesce(v_free, 0) > 0;
  if not v_use_free and coalesce(v_seeds, 0) < p_cost then
    raise exception 'insufficient_seeds';
  end if;

  insert into public.user_birds (user_id, species_key, rarity)
    values (p_user_id, p_species_key, p_rarity)
    returning id into v_bird;

  update public.user_game g set
    seeds = g.seeds - case when v_use_free then 0 else p_cost end,
    free_hatches = g.free_hatches - case when v_use_free then 1 else 0 end,
    active_bird_id = coalesce(g.active_bird_id, v_bird),
    updated_at = now()
  where g.user_id = p_user_id
  returning g.seeds into v_seeds;

  return query select v_bird, v_use_free, v_seeds;
end;
$$;

-- Sell: validate ownership + active/last-bird rules under the wallet lock, delete
-- the bird, and credit its rarity-based value atomically. Stored rarity wins;
-- p_fallback_rarity (server-derived from the catalog) covers pre-migration birds.
create or replace function public.sell_bird_for_user(
  p_user_id uuid, p_bird_id uuid, p_fallback_rarity text
)
returns table (value integer, seeds integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_rarity text;
  v_active uuid;
  v_count integer;
  v_value integer;
  v_seeds integer;
begin
  select g.active_bird_id into v_active
    from public.user_game g where g.user_id = p_user_id for update;

  select b.rarity into v_rarity
    from public.user_birds b where b.id = p_bird_id and b.user_id = p_user_id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_active is not distinct from p_bird_id then
    raise exception 'active_bird';
  end if;

  select count(*) into v_count from public.user_birds where user_id = p_user_id;
  if v_count <= 1 then
    raise exception 'last_bird';
  end if;

  v_value := public.bird_sell_value(coalesce(v_rarity, p_fallback_rarity));

  delete from public.user_birds where id = p_bird_id and user_id = p_user_id;

  update public.user_game g set
    seeds = g.seeds + v_value,
    total_earned = g.total_earned + v_value,
    updated_at = now()
  where g.user_id = p_user_id
  returning g.seeds into v_seeds;

  return query select v_value, v_seeds;
end;
$$;

-- Pet: once-per-local-day +2 seeds (idempotent via reward_ledger unique key) and
-- +4 XP to the companion, all under the wallet lock.
create or replace function public.pet_bird_for_user(
  p_user_id uuid, p_local_date date
)
returns table (bonus integer, seeds integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_key text := p_local_date::text || '|pet';
  v_bonus integer := 0;
  v_active uuid;
  v_seeds integer;
  v_inserted integer;
begin
  insert into public.reward_ledger (user_id, key, source, amount, awarded_on)
    values (p_user_id, v_key, 'pet', 2, p_local_date)
    on conflict (user_id, key) do nothing;
  get diagnostics v_inserted = row_count;
  v_bonus := case when v_inserted > 0 then 2 else 0 end;

  if v_bonus > 0 then
    select g.active_bird_id into v_active
      from public.user_game g where g.user_id = p_user_id for update;
    update public.user_game g set
      seeds = g.seeds + v_bonus, total_earned = g.total_earned + v_bonus, updated_at = now()
    where g.user_id = p_user_id
    returning g.seeds into v_seeds;
    if v_active is not null then
      update public.user_birds set xp = xp + 4 where id = v_active;
    end if;
  else
    select g.seeds into v_seeds from public.user_game g where g.user_id = p_user_id;
  end if;

  return query select v_bonus, v_seeds;
end;
$$;

-- Starter: one-time first bird + one banked free egg, guarded by starter_done.
create or replace function public.claim_starter_bird_for_user(
  p_user_id uuid, p_species_key text, p_rarity text
)
returns table (bird_id uuid)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_done boolean;
  v_active uuid;
  v_bird uuid;
begin
  insert into public.user_game (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  select g.starter_done, g.active_bird_id into v_done, v_active
    from public.user_game g where g.user_id = p_user_id for update;
  if coalesce(v_done, false) then
    raise exception 'already_done';
  end if;

  insert into public.user_birds (user_id, species_key, rarity)
    values (p_user_id, p_species_key, p_rarity)
    returning id into v_bird;

  update public.user_game g set
    starter_done = true, free_hatches = 1,
    active_bird_id = coalesce(g.active_bird_id, v_bird), updated_at = now()
  where g.user_id = p_user_id;

  return query select v_bird;
end;
$$;

-- Only the service-role server actions may call these (they pass a session-derived
-- p_user_id). Block direct PostgREST RPC from anon/authenticated clients —
-- Supabase's default privileges grant EXECUTE to anon/authenticated explicitly,
-- so revoking from PUBLIC alone is not enough; revoke from those roles too.
revoke execute on function public.bird_sell_value(text) from public, anon, authenticated;
revoke execute on function public.hatch_egg_for_user(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.sell_bird_for_user(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.pet_bird_for_user(uuid, date) from public, anon, authenticated;
revoke execute on function public.claim_starter_bird_for_user(uuid, text, text) from public, anon, authenticated;

grant execute on function public.bird_sell_value(text) to service_role;
grant execute on function public.hatch_egg_for_user(uuid, text, text, integer) to service_role;
grant execute on function public.sell_bird_for_user(uuid, uuid, text) to service_role;
grant execute on function public.pet_bird_for_user(uuid, date) to service_role;
grant execute on function public.claim_starter_bird_for_user(uuid, text, text) to service_role;
