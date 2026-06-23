-- Allow Fitbit as a connected provider alongside Oura and Google. The provider
-- column's check constraint is named oauth_connections_provider_check by default.

alter table public.oauth_connections drop constraint oauth_connections_provider_check;
alter table public.oauth_connections
  add constraint oauth_connections_provider_check check (provider in ('oura', 'google', 'fitbit'));
