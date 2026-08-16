-- Acquisitie Productiekern — private, append-only opslag voor BAT-documenten.
--
-- Alleen ingelogde interne gebruikers mogen nieuwe artifacts schrijven en hun
-- eigen productiepaden teruglezen. Er is bewust géén UPDATE/DELETE-policy:
-- eenmaal geüploade productie-artifacts kunnen vanuit de browser niet worden
-- overschreven of verwijderd. Elke renderpoging krijgt client-side een unieke
-- attempt-map; een afgebroken poging kan daardoor veilig opnieuw worden gestart.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'off-market-productie',
  'off-market-productie',
  false,
  20971520,
  array['application/pdf', 'text/csv']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf', 'text/csv'];

drop policy if exists "off_market_productie_insert_eigen_pad" on storage.objects;
create policy "off_market_productie_insert_eigen_pad"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'off-market-productie'
  and public.is_intern_gebruiker(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "off_market_productie_select_eigen_pad" on storage.objects;
create policy "off_market_productie_select_eigen_pad"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'off-market-productie'
  and public.is_intern_gebruiker(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Expliciet geen browsermutaties op bestaande artifacts.
drop policy if exists "off_market_productie_update_eigen_pad" on storage.objects;
drop policy if exists "off_market_productie_delete_eigen_pad" on storage.objects;
