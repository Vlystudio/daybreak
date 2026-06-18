-- Smart Grocery Shopper + Meal Planner.
-- Reuses existing: households, household_members, public.is_household_member(),
-- public.touch_updated_at(), audit_logs. Catalog tables are world-readable to
-- signed-in users; user/household data is RLS-scoped to the owner/household.

-- ── Reference: price sources ────────────────────────────────────────────────
create table public.price_sources (
  key text primary key,
  label text not null,
  is_live boolean not null default false
);
alter table public.price_sources enable row level security;
create policy "price_sources: read" on public.price_sources for select using (true);

-- ── Stores (global catalog) ─────────────────────────────────────────────────
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  default_pricing_source text not null default 'manual' references public.price_sources (key),
  website text,
  created_at timestamptz not null default now()
);
alter table public.stores enable row level security;
create policy "stores: read" on public.stores for select using (true);

create table public.store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  label text,
  address text,
  city text,
  region text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
alter table public.store_locations enable row level security;
create policy "store_locations: read" on public.store_locations for select using (true);
create index store_locations_store_idx on public.store_locations (store_id);

-- Per-user chosen stores (preference, distance, priority, refresh time).
create table public.user_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  store_location_id uuid references public.store_locations (id) on delete set null,
  priority int not null default 0,
  distance_miles numeric check (distance_miles >= 0),
  enabled boolean not null default true,
  last_price_refresh timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, store_id, store_location_id)
);
alter table public.user_stores enable row level security;
create policy "user_stores: own" on public.user_stores
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── Product catalog + normalized ingredients ────────────────────────────────
create table public.normalized_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text,
  created_at timestamptz not null default now()
);
alter table public.normalized_ingredients enable row level security;
create policy "normalized_ingredients: read" on public.normalized_ingredients for select using (true);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text,
  size_value numeric,
  size_unit text,
  upc text,
  normalized_ingredient_id uuid references public.normalized_ingredients (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "products: read" on public.products for select using (true);
create policy "products: insert" on public.products for insert with check ((select auth.uid()) = created_by);
create index products_ingredient_idx on public.products (normalized_ingredient_id);
create index products_upc_idx on public.products (upc);

-- Prices are shared (community/household), each tagged with its source and
-- whether it's estimated vs confirmed. NEVER seed fake prices.
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  store_location_id uuid references public.store_locations (id) on delete set null,
  price numeric check (price >= 0),
  sale_price numeric check (sale_price >= 0),
  unit_price numeric check (unit_price >= 0),
  unit text,
  package_size text,
  sale_expires date,
  source_key text references public.price_sources (key),
  is_estimated boolean not null default true,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now()
);
alter table public.product_prices enable row level security;
create policy "product_prices: read" on public.product_prices for select using (true);
create policy "product_prices: insert" on public.product_prices for insert with check ((select auth.uid()) = recorded_by);
create index product_prices_product_idx on public.product_prices (product_id);
create index product_prices_store_idx on public.product_prices (store_id);

-- ── Recipes ─────────────────────────────────────────────────────────────────
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  household_id uuid references public.households (id) on delete set null,
  is_public boolean not null default false,
  source text not null default 'user' check (source in ('user', 'ai', 'stored', 'imported')),
  title text not null,
  description text,
  instructions jsonb not null default '[]',
  servings int,
  prep_minutes int,
  cook_minutes int,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  fiber_g int,
  estimated_cost numeric,
  tags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipes enable row level security;
create policy "recipes: read" on public.recipes for select using (
  is_public
  or (select auth.uid()) = created_by
  or (household_id is not null and public.is_household_member(household_id))
);
create policy "recipes: insert" on public.recipes for insert with check ((select auth.uid()) = created_by);
create policy "recipes: update" on public.recipes for update using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
create policy "recipes: delete" on public.recipes for delete using ((select auth.uid()) = created_by);
create index recipes_owner_idx on public.recipes (created_by);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  normalized_ingredient_id uuid references public.normalized_ingredients (id) on delete set null,
  raw_name text not null,
  quantity numeric,
  unit text,
  notes text,
  sort int not null default 0
);
alter table public.recipe_ingredients enable row level security;
create policy "recipe_ingredients: read" on public.recipe_ingredients for select using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and (r.is_public or r.created_by = (select auth.uid())
        or (r.household_id is not null and public.is_household_member(r.household_id)))
  )
);
create policy "recipe_ingredients: write" on public.recipe_ingredients for all using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.created_by = (select auth.uid()))
) with check (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.created_by = (select auth.uid()))
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- ── Pantry (household-shared) ───────────────────────────────────────────────
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  normalized_ingredient_id uuid references public.normalized_ingredients (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric,
  unit text,
  location text not null default 'pantry' check (location in ('pantry', 'fridge', 'freezer')),
  expiration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pantry_items enable row level security;
create policy "pantry_items: read" on public.pantry_items for select using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "pantry_items: insert" on public.pantry_items for insert with check ((select auth.uid()) = user_id);
create policy "pantry_items: update" on public.pantry_items for update using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
) with check (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "pantry_items: delete" on public.pantry_items for delete using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create index pantry_items_user_idx on public.pantry_items (user_id);
create index pantry_items_household_idx on public.pantry_items (household_id);

-- ── Meal plans (household-shared) ───────────────────────────────────────────
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  title text,
  duration_days int not null check (duration_days in (7, 14, 30)),
  start_date date not null,
  budget numeric,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);
alter table public.meal_plans enable row level security;
create policy "meal_plans: read" on public.meal_plans for select using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "meal_plans: insert" on public.meal_plans for insert with check ((select auth.uid()) = user_id);
create policy "meal_plans: update" on public.meal_plans for update using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
) with check (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "meal_plans: delete" on public.meal_plans for delete using ((select auth.uid()) = user_id);
create index meal_plans_user_idx on public.meal_plans (user_id);

create table public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  date date not null,
  meals jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.meal_plan_days enable row level security;
create policy "meal_plan_days: read" on public.meal_plan_days for select using (
  exists (
    select 1 from public.meal_plans m
    where m.id = meal_plan_id
      and (m.user_id = (select auth.uid()) or (m.household_id is not null and public.is_household_member(m.household_id)))
  )
);
create policy "meal_plan_days: write" on public.meal_plan_days for all using (
  exists (
    select 1 from public.meal_plans m
    where m.id = meal_plan_id
      and (m.user_id = (select auth.uid()) or (m.household_id is not null and public.is_household_member(m.household_id)))
  )
) with check (
  exists (
    select 1 from public.meal_plans m
    where m.id = meal_plan_id
      and (m.user_id = (select auth.uid()) or (m.household_id is not null and public.is_household_member(m.household_id)))
  )
);
create index meal_plan_days_plan_idx on public.meal_plan_days (meal_plan_id);

-- ── Shopping lists (household-shared) ───────────────────────────────────────
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  title text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  estimated_total numeric,
  estimated_savings numeric,
  created_at timestamptz not null default now()
);
alter table public.shopping_lists enable row level security;
create policy "shopping_lists: read" on public.shopping_lists for select using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "shopping_lists: insert" on public.shopping_lists for insert with check ((select auth.uid()) = user_id);
create policy "shopping_lists: update" on public.shopping_lists for update using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
) with check (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "shopping_lists: delete" on public.shopping_lists for delete using ((select auth.uid()) = user_id);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  store_location_id uuid references public.store_locations (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  normalized_ingredient_id uuid references public.normalized_ingredients (id) on delete set null,
  name text not null,
  quantity numeric,
  unit text,
  estimated_price numeric,
  price_confirmed boolean not null default false,
  status text not null default 'needed' check (status in ('needed', 'owned', 'substituted', 'manual_price', 'purchased')),
  substituted_from text,
  notes text,
  sort int not null default 0
);
alter table public.shopping_list_items enable row level security;
create policy "shopping_list_items: read" on public.shopping_list_items for select using (
  exists (
    select 1 from public.shopping_lists s
    where s.id = shopping_list_id
      and (s.user_id = (select auth.uid()) or (s.household_id is not null and public.is_household_member(s.household_id)))
  )
);
create policy "shopping_list_items: write" on public.shopping_list_items for all using (
  exists (
    select 1 from public.shopping_lists s
    where s.id = shopping_list_id
      and (s.user_id = (select auth.uid()) or (s.household_id is not null and public.is_household_member(s.household_id)))
  )
) with check (
  exists (
    select 1 from public.shopping_lists s
    where s.id = shopping_list_id
      and (s.user_id = (select auth.uid()) or (s.household_id is not null and public.is_household_member(s.household_id)))
  )
);
create index shopping_list_items_list_idx on public.shopping_list_items (shopping_list_id);

-- ── Settings, goals, substitutions, analytics ───────────────────────────────
create table public.grocery_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_budget numeric check (weekly_budget >= 0),
  household_size int not null default 1 check (household_size between 1 and 30),
  max_stores_per_trip int not null default 2 check (max_stores_per_trip between 1 and 8),
  max_distance_miles numeric check (max_distance_miles >= 0),
  favorites jsonb not null default '[]',
  dislikes jsonb not null default '[]',
  allergies jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.grocery_settings enable row level security;
create policy "grocery_settings: own" on public.grocery_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.nutrition_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  fiber_g int,
  updated_at timestamptz not null default now()
);
alter table public.nutrition_goals enable row level security;
create policy "nutrition_goals: own" on public.nutrition_goals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Global substitution suggestions (cheaper / nutrition-preserving swaps).
create table public.substitutions (
  id uuid primary key default gen_random_uuid(),
  from_ingredient text not null,
  to_ingredient text not null,
  reason text,
  saves_money boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.substitutions enable row level security;
create policy "substitutions: read" on public.substitutions for select using (true);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  household_id uuid references public.households (id) on delete set null,
  type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;
create policy "analytics_events: read" on public.analytics_events for select using (
  (select auth.uid()) = user_id or (household_id is not null and public.is_household_member(household_id))
);
create policy "analytics_events: insert" on public.analytics_events for insert with check ((select auth.uid()) = user_id);
create index analytics_events_user_idx on public.analytics_events (user_id, created_at desc);

-- ── updated_at triggers ─────────────────────────────────────────────────────
create trigger touch_recipes before update on public.recipes for each row execute function public.touch_updated_at();
create trigger touch_pantry_items before update on public.pantry_items for each row execute function public.touch_updated_at();
create trigger touch_grocery_settings before update on public.grocery_settings for each row execute function public.touch_updated_at();
create trigger touch_nutrition_goals before update on public.nutrition_goals for each row execute function public.touch_updated_at();

-- ── Seed data (metadata only — NO fake prices) ──────────────────────────────
insert into public.price_sources (key, label, is_live) values
  ('official_api', 'Official store API', true),
  ('affiliate_api', 'Approved affiliate/grocery API', true),
  ('flyer_upload', 'User-uploaded flyer', false),
  ('receipt_parse', 'Parsed receipt', false),
  ('manual', 'Manual entry', false),
  ('cached_historical', 'Cached historical price', false),
  ('web', 'Permitted website data', true)
on conflict (key) do nothing;

insert into public.stores (slug, name, default_pricing_source, website) values
  ('hannaford', 'Hannaford', 'manual', 'https://www.hannaford.com'),
  ('trader-joes', 'Trader Joe''s', 'manual', 'https://www.traderjoes.com'),
  ('walmart', 'Walmart', 'manual', 'https://www.walmart.com'),
  ('market-basket', 'Market Basket', 'manual', 'https://www.shopmarketbasket.com'),
  ('costco', 'Costco', 'manual', 'https://www.costco.com'),
  ('aldi', 'Aldi', 'manual', 'https://www.aldi.us'),
  ('target', 'Target', 'manual', 'https://www.target.com'),
  ('whole-foods', 'Whole Foods Market', 'manual', 'https://www.wholefoodsmarket.com')
on conflict (slug) do nothing;

insert into public.normalized_ingredients (name, category) values
  ('cucumber', 'produce'),
  ('tomato', 'produce'),
  ('chicken breast', 'meat'),
  ('chicken thigh', 'meat'),
  ('ground turkey', 'meat'),
  ('salmon', 'seafood'),
  ('rice', 'grains'),
  ('greek yogurt', 'dairy'),
  ('eggs', 'dairy'),
  ('frozen berries', 'frozen'),
  ('spinach', 'produce')
on conflict (name) do nothing;

insert into public.substitutions (from_ingredient, to_ingredient, reason, saves_money) values
  ('salmon', 'chicken thigh', 'Much cheaper per serving while keeping high protein', true),
  ('steak', 'ground turkey', 'Lower cost, leaner protein', true),
  ('fresh berries', 'frozen berries', 'Cheaper and lasts longer with similar nutrition', true),
  ('name brand', 'store brand', 'Same product, lower price', true),
  ('out-of-season produce', 'seasonal produce', 'Cheaper and fresher in season', true)
on conflict do nothing;
