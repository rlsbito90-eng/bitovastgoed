-- Vastgoedrekenen Fase 1.1 — centraal kengetallenregister + onveranderlijke scenariosnapshots.
-- Registerwaarden mogen worden bijgewerkt; bestaande scenario's blijven rekenen met hun opgeslagen snapshot.

create table if not exists public.vastgoedrekenen_kengetallen (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  naam text not null,
  categorie text not null check (categorie in (
    'rendement', 'opbrengst', 'bouwkosten', 'projectkosten', 'verkoopkosten',
    'exploitatie', 'fiscaal', 'methodologie', 'overig'
  )),
  eenheid text not null,
  minimum_waarde numeric not null,
  basis_waarde numeric not null,
  maximum_waarde numeric not null,
  scenario_veld text null check (scenario_veld is null or scenario_veld in (
    'sale_target_margin_percentage',
    'sale_target_roi_percentage',
    'sale_target_margin_amount',
    'sale_costs_percentage',
    'unforeseen_percentage',
    'target_bar',
    'vacancy_percentage',
    'operating_cost_percentage',
    'maintenance_reserve_percentage',
    'management_cost_percentage'
  )),
  bron_type text not null default 'extern' check (bron_type in (
    'extern', 'intern', 'interne_werkhypothese', 'projectspecifiek', 'methodologie'
  )),
  bron_naam text not null,
  bron_referentie text null,
  bron_peildatum date not null,
  geldig_vanaf date null,
  vervaldatum date not null,
  toepassingsgebied text[] not null default '{}',
  regio text[] not null default '{}',
  projectfase text[] not null default '{}',
  risicoklasse text[] not null default '{}',
  betrouwbaarheid text not null check (betrouwbaarheid in ('laag', 'middel', 'hoog')),
  toelichting text null,
  actief boolean not null default true,
  versie integer not null default 1 check (versie > 0),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_kengetallen_bandbreedte_check
    check (minimum_waarde <= basis_waarde and basis_waarde <= maximum_waarde)
);

create index if not exists vastgoedrekenen_kengetallen_actief_idx
  on public.vastgoedrekenen_kengetallen (actief, categorie, naam);
create index if not exists vastgoedrekenen_kengetallen_vervaldatum_idx
  on public.vastgoedrekenen_kengetallen (vervaldatum);

alter table public.vastgoedrekenen_kengetallen enable row level security;

drop policy if exists "Authenticated users can read vastgoedrekenen kengetallen"
  on public.vastgoedrekenen_kengetallen;
create policy "Authenticated users can read vastgoedrekenen kengetallen"
  on public.vastgoedrekenen_kengetallen
  for select to authenticated
  using (true);

drop policy if exists "Authenticated users can manage vastgoedrekenen kengetallen"
  on public.vastgoedrekenen_kengetallen;
create policy "Authenticated users can manage vastgoedrekenen kengetallen"
  on public.vastgoedrekenen_kengetallen
  for all to authenticated
  using (true)
  with check (true);

create table if not exists public.scenario_kengetal_snapshots (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  kengetal_id uuid null references public.vastgoedrekenen_kengetallen(id) on delete set null,
  kengetal_code text not null,
  kengetal_naam text not null,
  categorie text not null,
  eenheid text not null,
  gekozen_band text not null check (gekozen_band in ('minimum', 'basis', 'maximum', 'handmatig')),
  gekozen_waarde numeric not null,
  minimum_waarde numeric not null,
  basis_waarde numeric not null,
  maximum_waarde numeric not null,
  scenario_veld text null,
  bron_type text not null,
  bron_naam text not null,
  bron_referentie text null,
  bron_peildatum date not null,
  vervaldatum date not null,
  toepassingsgebied text[] not null default '{}',
  regio text[] not null default '{}',
  projectfase text[] not null default '{}',
  risicoklasse text[] not null default '{}',
  betrouwbaarheid text not null,
  register_versie integer not null,
  overschreven boolean not null default false,
  override_reden text null,
  snapshot_op timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scenario_id, kengetal_code),
  constraint scenario_kengetal_snapshot_handmatig_check check (
    (gekozen_band = 'handmatig' and overschreven = true and nullif(trim(override_reden), '') is not null)
    or gekozen_band <> 'handmatig'
  )
);

create index if not exists scenario_kengetal_snapshots_scenario_idx
  on public.scenario_kengetal_snapshots (scenario_id, snapshot_op desc);

alter table public.scenario_kengetal_snapshots enable row level security;

drop policy if exists "Authenticated users can read scenario kengetal snapshots"
  on public.scenario_kengetal_snapshots;
create policy "Authenticated users can read scenario kengetal snapshots"
  on public.scenario_kengetal_snapshots
  for select to authenticated
  using (true);

drop policy if exists "Authenticated users can manage scenario kengetal snapshots"
  on public.scenario_kengetal_snapshots;
create policy "Authenticated users can manage scenario kengetal snapshots"
  on public.scenario_kengetal_snapshots
  for all to authenticated
  using (true)
  with check (true);

-- Interne werkhypothese uit de Den Haag-praktijkproef.
-- Dit is bewust géén marktkengetal en krijgt daarom betrouwbaarheid 'laag' en een korte geldigheid.
insert into public.vastgoedrekenen_kengetallen (
  code,
  naam,
  categorie,
  eenheid,
  minimum_waarde,
  basis_waarde,
  maximum_waarde,
  scenario_veld,
  bron_type,
  bron_naam,
  bron_referentie,
  bron_peildatum,
  geldig_vanaf,
  vervaldatum,
  toepassingsgebied,
  regio,
  projectfase,
  risicoklasse,
  betrouwbaarheid,
  toelichting
) values (
  'doelwinst_gdv_transformatie_randstad',
  'Doelwinst op GDV — transformatie Randstad',
  'rendement',
  '%',
  15,
  15,
  20,
  'sale_target_margin_percentage',
  'interne_werkhypothese',
  'Bito Vastgoed — Den Haag praktijkproef',
  'Basisscenario 15% GDV; voorzichtig scenario 20% GDV',
  date '2026-07-23',
  date '2026-07-23',
  date '2026-10-23',
  array['transformatie', 'sloop-nieuwbouw'],
  array['Den Haag', 'Randstad'],
  array['haalbaarheid', 'bieding'],
  array['basis', 'voorzichtig'],
  'laag',
  'Interne scenario-aanname zonder externe marktvalidatie. Niet presenteren als RICS-taxatie of algemeen marktkengetal.'
)
on conflict (code) do nothing;
