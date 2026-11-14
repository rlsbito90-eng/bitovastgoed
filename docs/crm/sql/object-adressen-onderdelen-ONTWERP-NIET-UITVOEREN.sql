-- Bito CRM / ontwerp DDL — NIET UITVOEREN OP PRODUCTIEDATABASE.
-- Geen Supabase-migratie. Dit document staat onder docs/ en wordt niet automatisch uitgevoerd.
-- Vereist: geïsoleerde testdatabase, verificatie bestaande rechten, RLS-regressies,
-- taxonomie-mapping, veilige hoofdadres-sync en volledig herstelplan.
--
-- OBJECT-ADRES: één object kan meerdere adressen hebben zonder meerdere objecten.
-- Adres is GEEN vastgoedunit en GEEN afzonderlijke verkooppropositie.
create table if not exists public.crm_object_adressen (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objecten(id) on delete restrict,
  adresregel text not null check (length(btrim(adresregel)) > 0),
  straat text,
  huisnummer text,
  huisletter text,
  toevoeging text,
  postcode text,
  plaats text not null check (length(btrim(plaats)) > 0),
  provincie text,
  land text not null default 'Nederland',
  bag_nummeraanduiding_id text,
  bag_verblijfsobject_id text,
  is_hoofdadres boolean not null default false,
  verificatie_status text not null default 'onbekend'
    check (verificatie_status in ('onbekend','te_controleren','geverifieerd')),
  bron text,
  bron_geverifieerd_op timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_object_adressen_object_en_id_unique unique (object_id,id)
);
create index if not exists crm_object_adressen_object_id_idx on public.crm_object_adressen(object_id);
create index if not exists crm_object_adressen_postcode_idx on public.crm_object_adressen(postcode);
create unique index if not exists crm_object_adressen_een_hoofd_idx
  on public.crm_object_adressen(object_id)
  where is_hoofdadres = true and archived_at is null;
-- De aanwezigheid van precies één hoofdadres moet voor elke objecttransactie
-- applicatie-/RPC-transactioneel worden gegarandeerd; unieke index alleen borgt maximaal één.

-- OBJECTONDERDELEN: functionele ruimtes of verhuureenheden per object.
-- Geen automatische m²-optelling over VVO/GBO/BVO zonder meetbasiscontrole.
create table if not exists public.crm_object_onderdelen (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objecten(id) on delete restrict,
  adres_id uuid,
  naam text not null check (length(btrim(naam)) > 0),
  gebruiksfunctie_code text,
  oppervlakte_m2 numeric(14,2) check (oppervlakte_m2 > 0),
  meetbasis text check (meetbasis in ('vvo','gbo','bvo')),
  huur_per_jaar numeric(14,2) check (huur_per_jaar >= 0),
  huur_bron text,
  zelfstandigheid_status text not null default 'onbekend'
    check (zelfstandigheid_status in ('onbekend','niet_zelfstandig','mogelijk','geverifieerd')),
  is_afzonderlijk_aangeboden boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_object_onderdelen_adres_bij_zelfde_object
    foreign key (object_id,adres_id)
    references public.crm_object_adressen(object_id,id) on delete restrict,
  constraint crm_object_onderdelen_m2_meetbasis
    check (oppervlakte_m2 is null or meetbasis is not null)
);
create index if not exists crm_object_onderdelen_object_id_idx on public.crm_object_onderdelen(object_id);
create index if not exists crm_object_onderdelen_adres_id_idx on public.crm_object_onderdelen(adres_id);

-- Toegang: geen anonieme Data API-toegang. Identiek intern autorisatiemodel
-- als huidige objecten; vóór uitrol moeten UPDATE/INSERT/DELETE-permissies worden getest.
revoke all on public.crm_object_adressen from anon;
revoke all on public.crm_object_onderdelen from anon;
grant select, insert, update, delete on public.crm_object_adressen to authenticated;
grant select, insert, update, delete on public.crm_object_onderdelen to authenticated;
alter table public.crm_object_adressen enable row level security;
alter table public.crm_object_onderdelen enable row level security;

create policy crm_object_adressen_intern_lezen
  on public.crm_object_adressen for select to authenticated
  using (public.is_intern_gebruiker((select auth.uid())));
create policy crm_object_adressen_intern_invoegen
  on public.crm_object_adressen for insert to authenticated
  with check (public.is_intern_gebruiker((select auth.uid())));
create policy crm_object_adressen_intern_wijzigen
  on public.crm_object_adressen for update to authenticated
  using (public.is_intern_gebruiker((select auth.uid())))
  with check (public.is_intern_gebruiker((select auth.uid())));
create policy crm_object_adressen_intern_verwijderen
  on public.crm_object_adressen for delete to authenticated
  using (public.is_intern_gebruiker((select auth.uid())));

create policy crm_object_onderdelen_intern_lezen
  on public.crm_object_onderdelen for select to authenticated
  using (public.is_intern_gebruiker((select auth.uid())));
create policy crm_object_onderdelen_intern_invoegen
  on public.crm_object_onderdelen for insert to authenticated
  with check (public.is_intern_gebruiker((select auth.uid())));
create policy crm_object_onderdelen_intern_wijzigen
  on public.crm_object_onderdelen for update to authenticated
  using (public.is_intern_gebruiker((select auth.uid())))
  with check (public.is_intern_gebruiker((select auth.uid())));
create policy crm_object_onderdelen_intern_verwijderen
  on public.crm_object_onderdelen for delete to authenticated
  using (public.is_intern_gebruiker((select auth.uid())));

-- Bewust NIET opgenomen: proposition/pipeline-migratie, automatische backfill,
-- verhuuraggregatie, synchronisatie naar objecten.adres, generieke criteriatabellen,
-- salesprijsverdeling en directe wijzigingen in matching.
