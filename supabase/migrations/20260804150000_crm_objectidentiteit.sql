-- Centrale CRM-objectidentiteit en bronkoppelingen.
-- Deze migratie wordt uitsluitend via de normale gecontroleerde migratieroute toegepast.

create table if not exists public.crm_objectregistraties (
  id uuid primary key default gen_random_uuid(),
  objectnummer bigint generated always as identity unique,
  bag_pand_id text,
  bag_verblijfsobject_id text,
  adres text not null,
  postcode text,
  plaats text,
  adres_sleutel text not null,
  objectniveau text not null default 'pand' check (objectniveau in ('pand', 'verblijfsobject', 'adres', 'complex')),
  status text not null default 'actief' check (status in ('actief', 'samengevoegd', 'vervallen')),
  samengevoegd_in_id uuid references public.crm_objectregistraties(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create unique index if not exists crm_objectregistraties_bag_vbo_uniek
  on public.crm_objectregistraties (bag_verblijfsobject_id)
  where bag_verblijfsobject_id is not null and status = 'actief';

create unique index if not exists crm_objectregistraties_bag_pand_adres_uniek
  on public.crm_objectregistraties (bag_pand_id, adres_sleutel)
  where bag_pand_id is not null and status = 'actief';

create index if not exists crm_objectregistraties_adres_sleutel_idx
  on public.crm_objectregistraties (adres_sleutel);

create table if not exists public.crm_objectbronkoppelingen (
  id uuid primary key default gen_random_uuid(),
  objectregistratie_id uuid not null references public.crm_objectregistraties(id) on delete cascade,
  bron_type text not null check (bron_type in ('vastgoedkans', 'object', 'off_market_signaal', 'deal', 'acquisitie_target')),
  bron_id uuid not null,
  koppelwijze text not null check (koppelwijze in ('bag_verblijfsobject', 'bag_pand', 'adres', 'handmatig')),
  actief boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (bron_type, bron_id)
);

create index if not exists crm_objectbronkoppelingen_object_idx
  on public.crm_objectbronkoppelingen (objectregistratie_id, actief);

alter table public.crm_objectregistraties enable row level security;
alter table public.crm_objectbronkoppelingen enable row level security;

create policy "crm_objectregistraties_lezen"
  on public.crm_objectregistraties for select to authenticated
  using (true);
create policy "crm_objectregistraties_schrijven"
  on public.crm_objectregistraties for all to authenticated
  using (true) with check (true);
create policy "crm_objectbronkoppelingen_lezen"
  on public.crm_objectbronkoppelingen for select to authenticated
  using (true);
create policy "crm_objectbronkoppelingen_schrijven"
  on public.crm_objectbronkoppelingen for all to authenticated
  using (true) with check (true);

comment on table public.crm_objectregistraties is
  'CRM-brede objectidentiteit; koppelt BAG-pand, verblijfsobject en adres zonder operationele dossiers te dupliceren.';
comment on table public.crm_objectbronkoppelingen is
  'Verbindt Vastgoedkansen, Objecten, Off-Market-signalen en latere processen aan één CRM-objectregistratie.';
