-- Vastgoedrekenen — scheid de fiscale verkrijgingsstructuur van de toekomstige project-/unitstructuur.
--
-- calculation_acquisition_components beschrijft uitsluitend de feitelijke/juridische delen
-- bij aankoop. calculation_acquisition_unit_links koppelt één huidig verkrijgingsdeel aan
-- één of meer toekomstige sell_off_units. De bestaande calculation_components blijven
-- beschikbaar voor huur, WWS en algemene projectcomponenten; bestaande scenario's blijven
-- via het applicatie-fallbackpad functioneren zolang deze nieuwe tabel leeg is.
--
-- Bewust TEXT + CHECK in plaats van project-specifieke enums: oudere/handmatig opgebouwde
-- Supabase-omgevingen hebben die enumtypes niet altijd, terwijl de applicatiewaarden gelijk zijn.

create table if not exists public.calculation_acquisition_components (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  component_name text not null,
  component_type text not null default 'overig'
    check (component_type in (
      'woning', 'appartement', 'studio', 'kamer',
      'winkelruimte', 'kantoorruimte', 'bedrijfsruimte', 'bedrijfsunit',
      'opslagruimte', 'kelder', 'parkeerplaats', 'garagebox', 'berging',
      'horeca', 'maatschappelijk', 'ontwikkelgrond',
      'woon_winkelpand', 'woon_kantoorpand', 'woon_bedrijfspand',
      'winkel_kantoorpand', 'mixed_use', 'mixed_use_overig', 'overig'
    )),
  floor_or_location text null,
  surface_gbo numeric null check (surface_gbo is null or surface_gbo >= 0),
  surface_vvo numeric null check (surface_vvo is null or surface_vvo >= 0),
  surface_bvo numeric null check (surface_bvo is null or surface_bvo >= 0),
  allocated_component_value numeric null check (allocated_component_value is null or allocated_component_value >= 0),
  transfer_tax_allocation_method text not null default 'value'
    check (transfer_tax_allocation_method in ('value', 'extern', 'm2', 'manual')),
  transfer_tax_classification text null
    check (transfer_tax_classification is null or transfer_tax_classification in (
      'eigen_woning', 'woning_belegging', 'niet_woning',
      'mixed_use', 'vrijgesteld', 'handmatig'
    )),
  transfer_tax_percentage numeric null check (transfer_tax_percentage is null or transfer_tax_percentage >= 0),
  transfer_tax_amount numeric null check (transfer_tax_amount is null or transfer_tax_amount >= 0),
  transfer_tax_manual_override boolean not null default false,
  source_note text null,
  reliability_status text null check (reliability_status is null or reliability_status in ('laag', 'middel', 'hoog')),
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calculation_acquisition_components_scenario_idx
  on public.calculation_acquisition_components (scenario_id, sort_order, created_at);

create table if not exists public.calculation_acquisition_unit_links (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  acquisition_component_id uuid not null references public.calculation_acquisition_components(id) on delete cascade,
  sell_off_unit_id uuid not null references public.sell_off_units(id) on delete cascade,
  allocation_weight numeric null check (allocation_weight is null or allocation_weight > 0),
  created_at timestamptz not null default now(),
  unique (acquisition_component_id, sell_off_unit_id)
);

create index if not exists calculation_acquisition_unit_links_scenario_idx
  on public.calculation_acquisition_unit_links (scenario_id, acquisition_component_id);
create index if not exists calculation_acquisition_unit_links_unit_idx
  on public.calculation_acquisition_unit_links (sell_off_unit_id);

alter table public.calculation_acquisition_components enable row level security;
alter table public.calculation_acquisition_unit_links enable row level security;

drop policy if exists "Authenticated users can manage acquisition components"
  on public.calculation_acquisition_components;
create policy "Authenticated users can manage acquisition components"
  on public.calculation_acquisition_components
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can manage acquisition unit links"
  on public.calculation_acquisition_unit_links;
create policy "Authenticated users can manage acquisition unit links"
  on public.calculation_acquisition_unit_links
  for all to authenticated
  using (true)
  with check (true);

comment on table public.calculation_acquisition_components is
  'Feitelijke/juridische componenten bij verkrijging; leidend voor OVB per component.';
comment on table public.calculation_acquisition_unit_links is
  'Een-op-veelkoppeling tussen huidige verkrijgingscomponenten en toekomstige strategie-units.';
comment on column public.calculation_acquisition_components.allocated_component_value is
  'Huidige waarde/verdeelsleutel bij verkrijging; niet de toekomstige GDV of verkoopwaarde.';
