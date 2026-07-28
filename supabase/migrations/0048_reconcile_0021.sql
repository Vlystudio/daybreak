-- Forward-only reconciliation for the historical duplicate version 0021.
-- Safe states handled:
--   * neither historical body present;
--   * either body present;
--   * both bodies present;
--   * missing columns/index/policies/trigger around an otherwise attributable
--     subjective_checkins table.
--
-- An existing populated table without user/date ownership cannot be repaired
-- honestly. In that ambiguous state this migration raises and rolls back rather
-- than assigning ownership or deleting data.

alter table public.daily_summaries add column if not exists input_hash text;
alter table public.fitness_plans add column if not exists input_hash text;

create table if not exists public.subjective_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.subjective_checkins
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists date date,
  add column if not exists mood smallint,
  add column if not exists energy smallint,
  add column if not exists stress smallint,
  add column if not exists soreness smallint,
  add column if not exists note text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from public.subjective_checkins
    where id is null or user_id is null or date is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'subjective_checkins has rows without attributable id/user/date; manual clone reconciliation required';
  end if;

  if exists (
    select 1 from public.subjective_checkins
    group by user_id, date having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'subjective_checkins has duplicate user/date rows; manual clone reconciliation required';
  end if;
end
$$;

alter table public.subjective_checkins
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column date set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subjective_checkins'::regclass
      and contype = 'p'
  ) then
    alter table public.subjective_checkins
      add constraint subjective_checkins_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subjective_checkins'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id)%REFERENCES auth.users(id)%'
  ) then
    alter table public.subjective_checkins
      add constraint subjective_checkins_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subjective_checkins'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, date)'
  ) then
    alter table public.subjective_checkins
      add constraint subjective_checkins_user_id_date_key unique (user_id, date);
  end if;
end
$$;

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('mood', 'subjective_checkins_mood_check', 'mood between 1 and 5'),
      ('energy', 'subjective_checkins_energy_check', 'energy between 1 and 5'),
      ('stress', 'subjective_checkins_stress_check', 'stress between 1 and 5'),
      ('soreness', 'subjective_checkins_soreness_check', 'soreness between 1 and 5'),
      ('note', 'subjective_checkins_note_check', 'char_length(note) <= 500')
    ) as expected(column_name, constraint_name, expression)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.subjective_checkins'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%' || item.expression || '%'
    ) then
      execute format(
        'alter table public.subjective_checkins add constraint %I check (%s) not valid',
        item.constraint_name,
        item.expression
      );
      execute format(
        'alter table public.subjective_checkins validate constraint %I',
        item.constraint_name
      );
    end if;
  end loop;
end
$$;

alter table public.subjective_checkins enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subjective_checkins'
      and policyname = 'subjective_checkins: read own'
  ) then
    create policy "subjective_checkins: read own" on public.subjective_checkins
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subjective_checkins'
      and policyname = 'subjective_checkins: insert own'
  ) then
    create policy "subjective_checkins: insert own" on public.subjective_checkins
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subjective_checkins'
      and policyname = 'subjective_checkins: update own'
  ) then
    create policy "subjective_checkins: update own" on public.subjective_checkins
      for update using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end
$$;

create index if not exists subjective_checkins_user_date_idx
  on public.subjective_checkins (user_id, date desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.subjective_checkins'::regclass
      and tgname = 'touch_subjective_checkins'
      and not tgisinternal
  ) then
    create trigger touch_subjective_checkins
      before update on public.subjective_checkins
      for each row execute function public.touch_updated_at();
  end if;
end
$$;
