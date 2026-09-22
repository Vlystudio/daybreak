-- New Supabase installations no longer necessarily grant Data API roles table
-- privileges by default. Match the existing production CRUD access explicitly;
-- RLS still decides which rows and operations each caller is allowed to use.
-- Do not grant TRUNCATE or change any function EXECUTE privileges.
do $$
declare
  target record;
begin
  for target in
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    if not target.relrowsecurity then
      raise exception 'Data API privilege target public.% must have RLS enabled', target.relname;
    end if;
    execute format(
      'grant select, insert, update, delete on table public.%I to anon, authenticated, service_role',
      target.relname
    );
  end loop;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
