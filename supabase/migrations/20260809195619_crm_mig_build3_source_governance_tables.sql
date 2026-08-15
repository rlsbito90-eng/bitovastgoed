create table if not exists public.vastgoedrekenen_bronpakketten (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  versie integer not null default 1,
  naam text not null,
  status text not null default 'concept',
  bron_type text not null,
  bron_naam text not null,
  bron_referentie text,
  bron_versie text,
  prijspeildatum date,
  geldig_vanaf date,
  vervaldatum date,
  valuta_code text not null default 'EUR',
  geografische_scope text,
  location_keys text[] not null default '{}',
  meetgrondslag text,
  scope_inclusief text,
  scope_exclusief text,
  indexeringsmethode text,
  betrouwbaarheid text not null default 'laag',
  toelichting text,
  system_managed boolean not null default false,
  goedgekeurd_door uuid references auth.users(id) on delete set null,
  goedgekeurd_op timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_bronpakketten_code_version_key unique (code,versie),
  constraint vastgoedrekenen_bronpakketten_versie_check check (versie > 0),
  constraint vastgoedrekenen_bronpakketten_status_check check (status in ('concept','goedgekeurd','gearchiveerd')),
  constraint vastgoedrekenen_bronpakketten_bron_type_check check (bron_type in ('extern','intern','interne_werkhypothese','projectspecifiek','methodologie')),
  constraint vastgoedrekenen_bronpakketten_betrouwbaarheid_check check (betrouwbaarheid in ('laag','middel','hoog')),
  constraint vastgoedrekenen_bronpakketten_valuta_check check (valuta_code ~ '^[A-Z]{3}$'),
  constraint vastgoedrekenen_bronpakketten_dates_check check ((geldig_vanaf is null or vervaldatum is null or geldig_vanaf <= vervaldatum) and (prijspeildatum is null or vervaldatum is null or prijspeildatum <= vervaldatum))
);
alter table public.vastgoedrekenen_bronpakketten enable row level security;
drop policy if exists "Authenticated users can read source packages" on public.vastgoedrekenen_bronpakketten;
create policy "Authenticated users can read source packages" on public.vastgoedrekenen_bronpakketten for select to authenticated using (true);
drop policy if exists "Authenticated users can manage source packages" on public.vastgoedrekenen_bronpakketten;
create policy "Authenticated users can manage source packages" on public.vastgoedrekenen_bronpakketten for all to authenticated using (true) with check (true);

alter table public.vastgoedrekenen_kengetallen add column if not exists bronpakket_id uuid;
alter table public.scenario_kengetal_snapshots add column if not exists bronpakket_id uuid, add column if not exists bronpakket_snapshot jsonb;
do $$ begin if not exists (select 1 from pg_constraint where conname='vastgoedrekenen_kengetallen_bronpakket_id_fkey') then alter table public.vastgoedrekenen_kengetallen add constraint vastgoedrekenen_kengetallen_bronpakket_id_fkey foreign key (bronpakket_id) references public.vastgoedrekenen_bronpakketten(id) on delete set null; end if; if not exists (select 1 from pg_constraint where conname='scenario_kengetal_snapshots_bronpakket_id_fkey') then alter table public.scenario_kengetal_snapshots add constraint scenario_kengetal_snapshots_bronpakket_id_fkey foreign key (bronpakket_id) references public.vastgoedrekenen_bronpakketten(id) on delete set null; end if; end $$;
create index if not exists vastgoedrekenen_kengetallen_bronpakket_idx on public.vastgoedrekenen_kengetallen(bronpakket_id);
create index if not exists scenario_kengetal_snapshots_bronpakket_idx on public.scenario_kengetal_snapshots(bronpakket_id);
create index if not exists vastgoedrekenen_bronpakketten_status_idx on public.vastgoedrekenen_bronpakketten(status,vervaldatum);

create table if not exists public.vastgoedrekenen_bronimport_runs (
  id uuid primary key default gen_random_uuid(),
  bronpakket_id uuid not null references public.vastgoedrekenen_bronpakketten(id) on delete restrict,
  bestand_naam text not null,
  bestand_type text not null,
  bestand_grootte bigint not null,
  bestand_sha256 text not null,
  werkblad text,
  kolom_mapping jsonb not null,
  validatie_samenvatting jsonb not null,
  rij_aantal integer not null,
  geimporteerd_aantal integer not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vastgoedrekenen_bronimport_type_check check (bestand_type in ('csv','xls','xlsx')),
  constraint vastgoedrekenen_bronimport_size_check check (bestand_grootte >= 0 and bestand_grootte <= 10485760),
  constraint vastgoedrekenen_bronimport_hash_check check (bestand_sha256 ~ '^[0-9a-f]{64}$'),
  constraint vastgoedrekenen_bronimport_count_check check (rij_aantal > 0 and rij_aantal <= 1000 and geimporteerd_aantal = rij_aantal),
  constraint vastgoedrekenen_bronimport_file_sheet_key unique (bronpakket_id,bestand_sha256,werkblad)
);
create index if not exists vastgoedrekenen_bronimport_package_created_idx on public.vastgoedrekenen_bronimport_runs (bronpakket_id,created_at desc);
alter table public.vastgoedrekenen_bronimport_runs enable row level security;
drop policy if exists "Authenticated users can read source import runs" on public.vastgoedrekenen_bronimport_runs;
create policy "Authenticated users can read source import runs" on public.vastgoedrekenen_bronimport_runs for select to authenticated using (true);

create or replace function public.vastgoedrekenen_bronimport_mapping_geldig(p_kolommen jsonb)
returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p_kolommen)='object'
    and (select count(*) from jsonb_each(p_kolommen)) between 7 and 22
    and p_kolommen ?& array['code','naam','categorie','unit_code','minimum_waarde','basis_waarde','maximum_waarde']
    and not exists (select 1 from jsonb_each(p_kolommen) item(key,value) where item.key not in ('code','naam','categorie','unit_code','minimum_waarde','basis_waarde','maximum_waarde','vat_treatment_code','scenario_veld','conservative_band','optimistic_band','asset_type_codes','strategy_codes','project_phase_codes','risk_class_codes','quality_level_codes','complexity_codes','location_type_codes','market_condition_codes','scenario_profile_codes','location_keys','toelichting') or jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}')='')
    and (select count(distinct lower(regexp_replace(item.value #>> '{}','[^a-zA-Z0-9]+','','g'))) from jsonb_each(p_kolommen) item(key,value)) = (select count(*) from jsonb_each(p_kolommen));
$$;

create table if not exists public.vastgoedrekenen_bronimport_mapping_profielen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  bron_naam text,
  kolommen jsonb not null,
  actief boolean not null default true,
  system_managed boolean not null default false,
  schema_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_bronimport_mapping_naam_check check (btrim(naam) <> ''),
  constraint vastgoedrekenen_bronimport_mapping_bron_check check (bron_naam is null or btrim(bron_naam) <> ''),
  constraint vastgoedrekenen_bronimport_mapping_schema_check check (schema_version = 1),
  constraint vastgoedrekenen_bronimport_mapping_inhoud_check check (public.vastgoedrekenen_bronimport_mapping_geldig(kolommen))
);
create unique index if not exists vastgoedrekenen_bronimport_mapping_owner_name_unique on public.vastgoedrekenen_bronimport_mapping_profielen(created_by,lower(btrim(naam))) where actief;
create index if not exists vastgoedrekenen_bronimport_mapping_source_idx on public.vastgoedrekenen_bronimport_mapping_profielen(lower(bron_naam),naam) where actief;
alter table public.vastgoedrekenen_bronimport_mapping_profielen enable row level security;
drop policy if exists "Authenticated users can read source import mapping profiles" on public.vastgoedrekenen_bronimport_mapping_profielen;
create policy "Authenticated users can read source import mapping profiles" on public.vastgoedrekenen_bronimport_mapping_profielen for select to authenticated using (actief);