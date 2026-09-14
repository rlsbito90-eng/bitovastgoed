-- De atomische batch-postactie is uitsluitend een geauthenticeerde
-- Productiekern-handeling. Maak de rolrechten expliciet, omdat bestaande
-- default privileges op het CRM-project `anon` anders execute kunnen geven.

revoke execute on function public.off_market_batch_gepost_markeren(
  uuid,
  uuid,
  text,
  integer,
  timestamptz
) from public, anon;

grant execute on function public.off_market_batch_gepost_markeren(
  uuid,
  uuid,
  text,
  integer,
  timestamptz
) to authenticated, service_role;
