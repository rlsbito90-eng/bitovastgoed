-- Fase 4E: expliciete kasstroomtiming voor algemene scenario-/projectkosten.
-- Additief, nullable en zonder backfill. Bestaande kostenposten blijven legacy
-- totdat de gebruiker de timing expliciet vastlegt.

alter table public.scenario_costs
  add column if not exists cashflow_timing_method text null,
  add column if not exists cashflow_start_month integer null,
  add column if not exists cashflow_end_month integer null,
  add column if not exists cashflow_payment_month integer null,
  add column if not exists cashflow_timing_schema_version integer null;

alter table public.scenario_costs
  drop constraint if exists scenario_costs_cashflow_timing_method_check,
  add constraint scenario_costs_cashflow_timing_method_check
    check (cashflow_timing_method is null or cashflow_timing_method in ('single', 'linear')),
  drop constraint if exists scenario_costs_cashflow_start_month_check,
  add constraint scenario_costs_cashflow_start_month_check
    check (cashflow_start_month is null or cashflow_start_month between 0 and 1200),
  drop constraint if exists scenario_costs_cashflow_end_month_check,
  add constraint scenario_costs_cashflow_end_month_check
    check (cashflow_end_month is null or cashflow_end_month between 0 and 1200),
  drop constraint if exists scenario_costs_cashflow_payment_month_check,
  add constraint scenario_costs_cashflow_payment_month_check
    check (cashflow_payment_month is null or cashflow_payment_month between 0 and 1200),
  drop constraint if exists scenario_costs_cashflow_timing_schema_version_check,
  add constraint scenario_costs_cashflow_timing_schema_version_check
    check (cashflow_timing_schema_version is null or cashflow_timing_schema_version = 1),
  drop constraint if exists scenario_costs_cashflow_timing_chronology_check,
  add constraint scenario_costs_cashflow_timing_chronology_check
    check (
      cashflow_start_month is null
      or cashflow_end_month is null
      or cashflow_end_month >= cashflow_start_month
    ),
  drop constraint if exists scenario_costs_cashflow_timing_contract_check,
  add constraint scenario_costs_cashflow_timing_contract_check
    check (
      (
        cashflow_timing_method is null
        and cashflow_start_month is null
        and cashflow_end_month is null
        and cashflow_payment_month is null
        and cashflow_timing_schema_version is null
      )
      or (
        cashflow_timing_schema_version = 1
        and (
          (
            cashflow_timing_method = 'single'
            and cashflow_payment_month is not null
            and cashflow_start_month is null
            and cashflow_end_month is null
          )
          or (
            cashflow_timing_method = 'linear'
            and cashflow_start_month is not null
            and cashflow_end_month is not null
            and cashflow_payment_month is null
          )
        )
      )
    );

comment on column public.scenario_costs.cashflow_timing_method is
  'Fase 4E: single = volledig in één maand; linear = lineair over start t/m einde.';
comment on column public.scenario_costs.cashflow_start_month is
  'Maand vanaf Quickscan-peildatum waarop een lineair verdeelde algemene kostenpost start.';
comment on column public.scenario_costs.cashflow_end_month is
  'Maand vanaf Quickscan-peildatum waarop een lineair verdeelde algemene kostenpost eindigt.';
comment on column public.scenario_costs.cashflow_payment_month is
  'Maand vanaf Quickscan-peildatum waarin een eenmalige algemene kostenpost volledig wordt betaald.';
comment on column public.scenario_costs.cashflow_timing_schema_version is
  'Versie van het expliciet opgeslagen timingcontract; null betekent legacy/ongetimed.';
