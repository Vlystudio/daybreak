-- Support importing the external grocery-deals feed (the "grocerytracker"
-- project) into the shared price catalog. Products created by an import are
-- tagged so a refresh can wipe and reload just those rows (their product_prices
-- cascade-delete with them), leaving manual/user prices untouched.

alter table public.products add column if not exists external_source text;

create index if not exists products_external_source_idx
  on public.products (external_source)
  where external_source is not null;
