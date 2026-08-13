-- BUILD 2.0B — centraal Eigenaarsregister
-- Acquisitie-eigenaren blijven gescheiden van commerciële CRM-relaties.

create table if not exists public.eigenaren (
  id uuid primary key default gen_random_uuid(),
  partij_type text not null default 'onbekend'
    check (partij_type in ('natuurlijk_persoon', 'rechtspersoon', 'onbekend')),
  naam text not null,
  bedrijfsnaam text,
  voornamen text,
  voorletters text,
  kvk_nummer text,
  adres text,
  postcode text,
  plaats text,
  land text,
  telefoon text,
  email text,
  website text,
  linkedin_url text,
  bron text not null default 'onbekend',
  bron_betrouwbaarheid smallint
    check (bron_betrouwbaarheid is null or bron_betrouwbaarheid between 0 and 100),
  bron_details jsonb not null default '{}'::jsonb,
  crm_relatie_id uuid references public.relaties(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.eigenaren is
  'Centraal acquisitieregister voor gevonden eigenaren/rechthebbenden; een record is niet automatisch een CRM-relatie.';
comment on column public.eigenaren.crm_relatie_id is
  'Optionele bewuste koppeling naar een bestaande commerciële CRM-relatie.';

create index if not exists eigenaren_naam_idx
  on public.eigenaren (lower(naam));
create index if not exists eigenaren_bedrijfsnaam_idx
  on public.eigenaren (lower(bedrijfsnaam))
  where bedrijfsnaam is not null;
create index if not exists eigenaren_kvk_idx
  on public.eigenaren (kvk_nummer)
  where kvk_nummer is not null;
create index if not exists eigenaren_crm_relatie_idx
  on public.eigenaren (crm_relatie_id)
  where crm_relatie_id is not null;

create table if not exists public.eigenaar_koppelingen (
  id uuid primary key default gen_random_uuid(),
  eigenaar_id uuid not null references public.eigenaren(id) on delete cascade,
  vastgoedkans_id uuid references public.vastgoedkansen(id) on delete cascade,
  signaal_id uuid references public.off_market_signalen(id) on delete cascade,
  object_id uuid references public.objecten(id) on delete cascade,
  kadaster_record_id uuid references public.kadaster_data_records(id) on delete set null,
  rol text not null default 'rechthebbende',
  rechtsoort text,
  aandeel text,
  bron text not null default 'kadaster',
  betrouwbaarheid smallint
    check (betrouwbaarheid is null or betrouwbaarheid between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eigenaar_koppelingen_exact_een_doel check (
    ((vastgoedkans_id is not null)::int +
     (signaal_id is not null)::int +
     (object_id is not null)::int) = 1
  )
);

comment on table public.eigenaar_koppelingen is
  'Koppelt één centrale eigenaar aan exact één Vastgoedkans, Radar-signaal of Object, met bron/recht-context.';

create unique index if not exists eigenaar_koppelingen_vastgoedkans_unique
  on public.eigenaar_koppelingen (eigenaar_id, vastgoedkans_id)
  where vastgoedkans_id is not null;
create unique index if not exists eigenaar_koppelingen_signaal_unique
  on public.eigenaar_koppelingen (eigenaar_id, signaal_id)
  where signaal_id is not null;
create unique index if not exists eigenaar_koppelingen_object_unique
  on public.eigenaar_koppelingen (eigenaar_id, object_id)
  where object_id is not null;
create index if not exists eigenaar_koppelingen_kadaster_record_idx
  on public.eigenaar_koppelingen (kadaster_record_id)
  where kadaster_record_id is not null;

alter table public.eigenaren enable row level security;
alter table public.eigenaar_koppelingen enable row level security;

create policy "Intern leest eigenaren"
  on public.eigenaren for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern voegt eigenaren toe"
  on public.eigenaren for insert to authenticated
  with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt eigenaren"
  on public.eigenaren for update to authenticated
  using (public.is_intern_gebruiker(auth.uid()))
  with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern archiveert/verwijdert eigenaren"
  on public.eigenaren for delete to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

create policy "Intern leest eigenaar koppelingen"
  on public.eigenaar_koppelingen for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern voegt eigenaar koppelingen toe"
  on public.eigenaar_koppelingen for insert to authenticated
  with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt eigenaar koppelingen"
  on public.eigenaar_koppelingen for update to authenticated
  using (public.is_intern_gebruiker(auth.uid()))
  with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern verwijdert eigenaar koppelingen"
  on public.eigenaar_koppelingen for delete to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

create trigger eigenaren_set_updated_at
  before update on public.eigenaren
  for each row execute function public.update_updated_at_column();

create trigger eigenaar_koppelingen_set_updated_at
  before update on public.eigenaar_koppelingen
  for each row execute function public.update_updated_at_column();
