-- Gedeelde vastgoed-intelligencelaag voor Radar, Pandenverkennen, Vastgoedkansen en Objecten.
-- Brondata is BAG-gecentreerd zodat dezelfde verrijking herbruikbaar is.
-- API-integraties staan standaard fail-closed / uit.

create table if not exists public.vastgoed_intelligence_config (
  id boolean primary key default true check (id = true),
  energy_enabled boolean not null default false,
  planology_enabled boolean not null default false,
  auto_energy_after_bag boolean not null default false,
  auto_planology_after_bag boolean not null default false,
  energy_refresh_days integer not null default 30 check (energy_refresh_days between 1 and 3650),
  planology_refresh_days integer not null default 30 check (planology_refresh_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

insert into public.vastgoed_intelligence_config (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.vastgoed_energielabel_snapshots (
  id uuid primary key default gen_random_uuid(),
  bag_vbo_id text not null,
  bag_nummeraanduiding_id text null,
  bag_pand_id text null,
  adres text null,
  postcode text null,
  plaats text null,
  energielabel text null,
  gebouwklasse text null,
  gebruiksfunctie text null,
  energie_index numeric null,
  primair_fossiel_energiegebruik numeric null,
  registratiedatum date null,
  geldig_tot date null,
  status text null,
  match_kwaliteit text not null default 'exact' check (match_kwaliteit in ('exact','adres','fallback','onbekend')),
  bron text not null default 'ep_online',
  bron_referentie text null,
  raw_payload jsonb not null default '{}'::jsonb,
  opgehaald_op timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_vastgoed_energy_vbo_opgehaald
  on public.vastgoed_energielabel_snapshots (bag_vbo_id, opgehaald_op desc);
create index if not exists idx_vastgoed_energy_pand_opgehaald
  on public.vastgoed_energielabel_snapshots (bag_pand_id, opgehaald_op desc)
  where bag_pand_id is not null;
create index if not exists idx_vastgoed_energy_label
  on public.vastgoed_energielabel_snapshots (energielabel)
  where energielabel is not null;

create table if not exists public.vastgoed_planologie_snapshots (
  id uuid primary key default gen_random_uuid(),
  bag_pand_id text null,
  bag_vbo_id text null,
  bag_nummeraanduiding_id text null,
  latitude double precision null,
  longitude double precision null,
  adres text null,
  gemeente text null,
  bevoegd_gezag text null,
  omgevingsdocument_id text null,
  omgevingsdocument_naam text null,
  omgevingsdocument_type text null,
  locatie_id text null,
  planologische_functies text[] not null default '{}'::text[],
  relevante_activiteiten text[] not null default '{}'::text[],
  regels jsonb not null default '[]'::jsonb,
  beperkingen jsonb not null default '[]'::jsonb,
  bron_documenten jsonb not null default '[]'::jsonb,
  match_kwaliteit text not null default 'onbekend' check (match_kwaliteit in ('exact','geometrie','adres','fallback','onbekend')),
  bron text not null default 'dso_omgevingswet',
  raw_payload jsonb not null default '{}'::jsonb,
  opgehaald_op timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_vastgoed_planologie_pand_opgehaald
  on public.vastgoed_planologie_snapshots (bag_pand_id, opgehaald_op desc)
  where bag_pand_id is not null;
create index if not exists idx_vastgoed_planologie_vbo_opgehaald
  on public.vastgoed_planologie_snapshots (bag_vbo_id, opgehaald_op desc)
  where bag_vbo_id is not null;
create index if not exists idx_vastgoed_planologie_document
  on public.vastgoed_planologie_snapshots (omgevingsdocument_id)
  where omgevingsdocument_id is not null;

alter table public.vastgoed_intelligence_config enable row level security;
alter table public.vastgoed_energielabel_snapshots enable row level security;
alter table public.vastgoed_planologie_snapshots enable row level security;

revoke all on public.vastgoed_intelligence_config from anon;
revoke all on public.vastgoed_energielabel_snapshots from anon;
revoke all on public.vastgoed_planologie_snapshots from anon;

grant select on public.vastgoed_intelligence_config to authenticated;
grant select on public.vastgoed_energielabel_snapshots to authenticated;
grant select on public.vastgoed_planologie_snapshots to authenticated;

create policy vastgoed_intelligence_config_intern_select
  on public.vastgoed_intelligence_config for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

create policy vastgoed_energielabel_intern_select
  on public.vastgoed_energielabel_snapshots for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

create policy vastgoed_planologie_intern_select
  on public.vastgoed_planologie_snapshots for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

comment on table public.vastgoed_energielabel_snapshots is
  'Herbruikbare EP-Online brondata per BAG-object; geen Radar-specifieke opslag.';
comment on table public.vastgoed_planologie_snapshots is
  'Herbruikbare DSO/Omgevingswet planologische brondata per BAG-object/locatie.';
comment on table public.vastgoed_intelligence_config is
  'Fail-closed switches voor energie- en planologieverrijking; API-sleutels staan uitsluitend als Edge secrets.';
