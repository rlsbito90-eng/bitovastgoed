create table if not exists public.vastgoedrekenen_kengetallen (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  naam text not null,
  categorie text not null check (categorie in ('rendement','opbrengst','bouwkosten','projectkosten','verkoopkosten','exploitatie','fiscaal','methodologie','overig')),
  eenheid text not null,
  minimum_waarde numeric not null,
  basis_waarde numeric not null,
  maximum_waarde numeric not null,
  scenario_veld text null check (scenario_veld is null or scenario_veld in ('sale_target_margin_percentage','sale_target_roi_percentage','sale_target_margin_amount','sale_costs_percentage','unforeseen_percentage','target_bar','vacancy_percentage','operating_cost_percentage','maintenance_reserve_percentage','management_cost_percentage')),
  bron_type text not null default 'extern' check (bron_type in ('extern','intern','interne_werkhypothese','projectspecifiek','methodologie')),
  bron_naam text not null,
  bron_referentie text null,
  bron_peildatum date not null,
  geldig_vanaf date null,
  vervaldatum date not null,
  toepassingsgebied text[] not null default '{}',
  regio text[] not null default '{}',
  projectfase text[] not null default '{}',
  risicoklasse text[] not null default '{}',
  betrouwbaarheid text not null check (betrouwbaarheid in ('laag','middel','hoog')),
  toelichting text null,
  actief boolean not null default true,
  versie integer not null default 1 check (versie > 0),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_kengetallen_bandbreedte_check check (minimum_waarde <= basis_waarde and basis_waarde <= maximum_waarde)
);
create index if not exists vastgoedrekenen_kengetallen_actief_idx on public.vastgoedrekenen_kengetallen (actief,categorie,naam);
create index if not exists vastgoedrekenen_kengetallen_vervaldatum_idx on public.vastgoedrekenen_kengetallen (vervaldatum);
alter table public.vastgoedrekenen_kengetallen enable row level security;
drop policy if exists "Authenticated users can read vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen;
create policy "Authenticated users can read vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen for select to authenticated using (true);
drop policy if exists "Authenticated users can manage vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen;
create policy "Authenticated users can manage vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen for all to authenticated using (true) with check (true);

create table if not exists public.scenario_kengetal_snapshots (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  kengetal_id uuid null references public.vastgoedrekenen_kengetallen(id) on delete set null,
  kengetal_code text not null,
  kengetal_naam text not null,
  categorie text not null,
  eenheid text not null,
  gekozen_band text not null check (gekozen_band in ('minimum','basis','maximum','handmatig')),
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
  constraint scenario_kengetal_snapshot_handmatig_check check ((gekozen_band='handmatig' and overschreven=true and nullif(trim(override_reden),'') is not null) or gekozen_band <> 'handmatig')
);
create index if not exists scenario_kengetal_snapshots_scenario_idx on public.scenario_kengetal_snapshots (scenario_id, snapshot_op desc);
alter table public.scenario_kengetal_snapshots enable row level security;
drop policy if exists "Authenticated users can read scenario kengetal snapshots" on public.scenario_kengetal_snapshots;
create policy "Authenticated users can read scenario kengetal snapshots" on public.scenario_kengetal_snapshots for select to authenticated using (true);
drop policy if exists "Authenticated users can manage scenario kengetal snapshots" on public.scenario_kengetal_snapshots;
create policy "Authenticated users can manage scenario kengetal snapshots" on public.scenario_kengetal_snapshots for all to authenticated using (true) with check (true);

create table if not exists public.calculation_acquisition_components (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  component_name text not null,
  component_type text not null default 'overig',
  floor_or_location text null,
  surface_gbo numeric null check (surface_gbo is null or surface_gbo >= 0),
  surface_vvo numeric null check (surface_vvo is null or surface_vvo >= 0),
  surface_bvo numeric null check (surface_bvo is null or surface_bvo >= 0),
  allocated_component_value numeric null check (allocated_component_value is null or allocated_component_value >= 0),
  transfer_tax_allocation_method text not null default 'value' check (transfer_tax_allocation_method in ('value','extern','m2','manual')),
  transfer_tax_classification text null check (transfer_tax_classification is null or transfer_tax_classification in ('eigen_woning','woning_belegging','niet_woning','mixed_use','vrijgesteld','handmatig')),
  transfer_tax_percentage numeric null check (transfer_tax_percentage is null or transfer_tax_percentage >= 0),
  transfer_tax_amount numeric null check (transfer_tax_amount is null or transfer_tax_amount >= 0),
  transfer_tax_manual_override boolean not null default false,
  source_note text null,
  reliability_status text null check (reliability_status is null or reliability_status in ('laag','middel','hoog')),
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calculation_acquisition_components_scenario_idx on public.calculation_acquisition_components (scenario_id,sort_order,created_at);
create table if not exists public.calculation_acquisition_unit_links (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  acquisition_component_id uuid not null references public.calculation_acquisition_components(id) on delete cascade,
  sell_off_unit_id uuid not null references public.sell_off_units(id) on delete cascade,
  allocation_weight numeric null check (allocation_weight is null or allocation_weight > 0),
  created_at timestamptz not null default now(),
  unique (acquisition_component_id,sell_off_unit_id)
);
create index if not exists calculation_acquisition_unit_links_scenario_idx on public.calculation_acquisition_unit_links (scenario_id,acquisition_component_id);
create index if not exists calculation_acquisition_unit_links_unit_idx on public.calculation_acquisition_unit_links (sell_off_unit_id);
alter table public.calculation_acquisition_components enable row level security;
alter table public.calculation_acquisition_unit_links enable row level security;
drop policy if exists "Authenticated users can manage acquisition components" on public.calculation_acquisition_components;
create policy "Authenticated users can manage acquisition components" on public.calculation_acquisition_components for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can manage acquisition unit links" on public.calculation_acquisition_unit_links;
create policy "Authenticated users can manage acquisition unit links" on public.calculation_acquisition_unit_links for all to authenticated using (true) with check (true);
alter table public.calculation_acquisition_components drop constraint if exists calculation_acquisition_components_component_type_check;
alter table public.calculation_acquisition_components add constraint calculation_acquisition_components_component_type_check check (component_type in ('woning','appartement','studio','kamer','winkelruimte','kantoorruimte','bedrijfsruimte','bedrijfsunit','opslagruimte','kelder','parkeerplaats','garagebox','berging','horeca','maatschappelijk','ontwikkelgrond','woon_winkelpand','woon_kantoorpand','woon_bedrijfspand','winkel_kantoorpand','mixed_use','mixed_use_overig','overig'));