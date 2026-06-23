-- Profile pictures + a short bio. Avatars live in a public storage bucket;
-- uploads go through a server action with the service role, and the public URL
-- is stored on profiles.avatar_url (column already exists).

alter table public.profiles add column if not exists bio text check (char_length(bio) <= 160);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
