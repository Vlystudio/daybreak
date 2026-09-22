begin;
select plan(7);

select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  'anonymous clients cannot invoke the signup trigger');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'signed-in clients cannot invoke the signup trigger');
select ok(not has_function_privilege('anon', 'public.my_connections()', 'execute'),
  'anonymous clients cannot call the connection RPC');
select ok(has_function_privilege('authenticated', 'public.my_connections()', 'execute'),
  'signed-in clients retain their connection RPC');
select ok(not has_function_privilege('anon', 'public.is_household_member(uuid)', 'execute'),
  'anonymous clients cannot call the membership helper');
select ok(has_function_privilege('authenticated', 'public.is_household_member(uuid)', 'execute'),
  'authenticated RLS policies retain their membership helper');
select ok((select proconfig @> array['search_path=pg_catalog']
  from pg_proc where oid = 'public.touch_updated_at()'::regprocedure),
  'the timestamp trigger has a fixed search path');

select * from finish();
rollback;
