-- Vastgoedrekenen — comparatieve waardering
-- Additief, backward compatible en zonder automatische toepassing op scenario-input.

alter table public.referentie_objecten
  add column if not exists price_type text not null default 'asking_price',
  add column if not exists transaction_date date,
  add column if not exists valuation_date date,
  add column if not exists source_reference text,
  add column if not exists source_reliability text;

do $$ begin
  alter table public.referentie_objecten
    add constraint referentie_objecten_price_type_check
    check (price_type in ('asking_price', 'transaction_price', 'valuation', 'other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.referentie_objecten
    add constraint referentie_objecten_source_reliability_check
    check (source_reliability is null or source_reliability in ('high', 'medium', 'low', 'unknown'));
exception when duplicate_object then null; end $$;

create table if not exists public.comparative_valuations (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.real_estate_calculations(id) on delete cascade,
  scenario_id uuid references public.calculation_scenarios(id) on delete cascade,
  object_id uuid not null references public.objecten(id) on delete cascade,
  purpose text not null,
  basis text not null default 'per_m2',
  method text not null default 'median',
  subject_area_m2 numeric,
  indicated_unit_value numeric,
  indicated_total_value bigint,
  lower_value bigint,
  upper_value bigint,
  reliability text not null default 'low',
  valuation_date date not null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comparative_valuations_purpose_check check (purpose in ('current_market_value', 'exit_value', 'component_value')),
  constraint comparative_valuations_basis_check check (basis in ('per_m2', 'per_unit')),
  constraint comparative_valuations_method_check check (method in ('median', 'weighted_average')),
  constraint comparative_valuations_reliability_check check (reliability in ('high', 'medium', 'low')),
  constraint comparative_valuations_numbers_check check (
    (subject_area_m2 is null or subject_area_m2 >= 0)
    and (indicated_unit_value is null or indicated_unit_value >= 0)
    and (indicated_total_value is null or indicated_total_value >= 0)
    and (lower_value is null or lower_value >= 0)
    and (upper_value is null or upper_value >= 0)
  )
);

create table if not exists public.comparative_valuation_references (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.comparative_valuations(id) on delete cascade,
  reference_object_id uuid references public.referentie_objecten(id) on delete set null,
  included boolean not null default true,
  snapshot_address text not null,
  snapshot_place text not null,
  snapshot_asset_class text not null,
  snapshot_price_type text not null,
  snapshot_price bigint not null,
  snapshot_area_m2 numeric,
  snapshot_unit_price numeric,
  snapshot_transaction_date date,
  snapshot_valuation_date date,
  snapshot_source_reference text,
  snapshot_source_reliability text,
  location_adjustment_pct numeric not null default 0,
  size_adjustment_pct numeric not null default 0,
  condition_adjustment_pct numeric not null default 0,
  energy_adjustment_pct numeric not null default 0,
  occupancy_adjustment_pct numeric not null default 0,
  other_adjustment_pct numeric not null default 0,
  other_adjustment_reason text,
  adjusted_unit_price numeric,
  weight numeric not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comparative_valuation_references_price_type_check check (snapshot_price_type in ('asking_price', 'transaction_price', 'valuation', 'other')),
  constraint comparative_valuation_references_source_reliability_check check (snapshot_source_reliability is null or snapshot_source_reliability in ('high', 'medium', 'low', 'unknown')),
  constraint comparative_valuation_references_numbers_check check (
    snapshot_price >= 0
    and (snapshot_area_m2 is null or snapshot_area_m2 >= 0)
    and (snapshot_unit_price is null or snapshot_unit_price >= 0)
    and (adjusted_unit_price is null or adjusted_unit_price >= 0)
    and weight > 0
  )
);

create index if not exists comparative_valuations_calculation_idx on public.comparative_valuations(calculation_id);
create index if not exists comparative_valuations_scenario_idx on public.comparative_valuations(scenario_id);
create index if not exists comparative_valuation_references_valuation_idx on public.comparative_valuation_references(valuation_id);

alter table public.comparative_valuations enable row level security;
alter table public.comparative_valuation_references enable row level security;

do $$ begin
  create policy "authenticated comparative valuations" on public.comparative_valuations
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated comparative valuation references" on public.comparative_valuation_references
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
