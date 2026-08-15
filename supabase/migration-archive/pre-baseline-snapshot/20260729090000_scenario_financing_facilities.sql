create table if not exists public.scenario_financing_facilities (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.calculation_scenarios(id) on delete cascade,
  facility_name text not null,
  facility_type text not null,
  commitment_amount numeric not null,
  draw_method text not null,
  draw_start_month integer not null,
  annual_interest_rate_pct numeric not null,
  interest_method text not null,
  arrangement_fee_pct numeric null,
  arrangement_fee_amount numeric null,
  repayment_method text not null,
  amortization_start_month integer null,
  maturity_month integer not null,
  source text not null,
  notes text null,
  sort_order integer not null default 0,
  schema_version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scenario_financing_facilities_name_check
    check (length(trim(facility_name)) > 0),
  constraint scenario_financing_facilities_type_check
    check (facility_type in ('acquisition', 'development', 'bridge', 'mortgage', 'other')),
  constraint scenario_financing_facilities_commitment_check
    check (commitment_amount > 0),
  constraint scenario_financing_facilities_draw_method_check
    check (draw_method in ('single_month', 'project_deficit')),
  constraint scenario_financing_facilities_draw_start_check
    check (draw_start_month between 0 and 1200),
  constraint scenario_financing_facilities_interest_rate_check
    check (annual_interest_rate_pct between 0 and 100),
  constraint scenario_financing_facilities_interest_method_check
    check (interest_method in ('cash', 'capitalized')),
  constraint scenario_financing_facilities_fee_pct_check
    check (arrangement_fee_pct is null or arrangement_fee_pct between 0 and 100),
  constraint scenario_financing_facilities_fee_amount_check
    check (arrangement_fee_amount is null or arrangement_fee_amount >= 0),
  constraint scenario_financing_facilities_single_fee_basis_check
    check (not (arrangement_fee_pct is not null and arrangement_fee_amount is not null)),
  constraint scenario_financing_facilities_repayment_method_check
    check (repayment_method in ('bullet', 'linear')),
  constraint scenario_financing_facilities_maturity_check
    check (maturity_month between 1 and 1200 and maturity_month > draw_start_month),
  constraint scenario_financing_facilities_amortization_check
    check (
      (repayment_method = 'bullet' and amortization_start_month is null)
      or (
        repayment_method = 'linear'
        and amortization_start_month is not null
        and amortization_start_month between draw_start_month and maturity_month
      )
    ),
  constraint scenario_financing_facilities_source_check
    check (length(trim(source)) > 0),
  constraint scenario_financing_facilities_schema_version_check
    check (schema_version = 1)
);

create index if not exists scenario_financing_facilities_scenario_sort_idx
  on public.scenario_financing_facilities (scenario_id, sort_order, created_at);

alter table public.scenario_financing_facilities enable row level security;

create policy "Intern leest scenario_financing_facilities"
  on public.scenario_financing_facilities
  for select
  using (public.is_intern_gebruiker(auth.uid()));

create policy "Intern voegt scenario_financing_facilities toe"
  on public.scenario_financing_facilities
  for insert
  with check (public.is_intern_gebruiker(auth.uid()));

create policy "Intern wijzigt scenario_financing_facilities"
  on public.scenario_financing_facilities
  for update
  using (public.is_intern_gebruiker(auth.uid()));

create policy "Intern verwijdert scenario_financing_facilities"
  on public.scenario_financing_facilities
  for delete
  using (public.is_intern_gebruiker(auth.uid()));

comment on table public.scenario_financing_facilities is
  'Fase 5B: afzonderlijke financieringsfaciliteiten bovenop de ongefinancierde scenariokasstroom.';
comment on column public.scenario_financing_facilities.commitment_amount is
  'Maximaal op te nemen hoofdsom; ongebruikte ruimte wordt niet als projectopbrengst geboekt.';
comment on column public.scenario_financing_facilities.draw_method is
  'single_month = alleen in de gekozen maand; project_deficit = per maand voor negatieve projectkasstroom.';
comment on column public.scenario_financing_facilities.interest_method is
  'cash = rente door equity betaald; capitalized = rente bij de schuld opgeteld.';
comment on column public.scenario_financing_facilities.repayment_method is
  'bullet = volledige aflossing in eindmaand; linear = dynamisch lineair tot eindmaand.';
