-- Fase 5A: expliciete scenario-instellingen voor ongefinancierde DCF.
-- Additief, nullable en zonder backfill. Er wordt bewust geen disconteringsvoet
-- afgeleid of automatisch ingevuld.

alter table public.calculation_scenarios
  add column if not exists dcf_discount_rate_pct numeric(8,4) null,
  add column if not exists dcf_discount_rate_source text null,
  add column if not exists dcf_discount_rate_notes text null,
  add column if not exists dcf_schema_version integer null;

alter table public.calculation_scenarios
  drop constraint if exists calculation_scenarios_dcf_discount_rate_check,
  add constraint calculation_scenarios_dcf_discount_rate_check
    check (dcf_discount_rate_pct is null or dcf_discount_rate_pct between 0 and 100),
  drop constraint if exists calculation_scenarios_dcf_schema_version_check,
  add constraint calculation_scenarios_dcf_schema_version_check
    check (dcf_schema_version is null or dcf_schema_version = 1),
  drop constraint if exists calculation_scenarios_dcf_contract_check,
  add constraint calculation_scenarios_dcf_contract_check
    check (
      (
        dcf_discount_rate_pct is null
        and dcf_discount_rate_source is null
        and dcf_discount_rate_notes is null
        and dcf_schema_version is null
      )
      or (
        dcf_discount_rate_pct is not null
        and dcf_discount_rate_source is not null
        and btrim(dcf_discount_rate_source) <> ''
        and dcf_schema_version = 1
      )
    );

comment on column public.calculation_scenarios.dcf_discount_rate_pct is
  'Jaarlijkse effectieve disconteringsvoet in procenten voor de ongefinancierde maandkasstroom.';
comment on column public.calculation_scenarios.dcf_discount_rate_source is
  'Door de gebruiker vastgelegde bron of onderbouwing van de disconteringsvoet.';
comment on column public.calculation_scenarios.dcf_discount_rate_notes is
  'Optionele toelichting op de gekozen ongefinancierde disconteringsvoet.';
comment on column public.calculation_scenarios.dcf_schema_version is
  'Versie van het expliciet opgeslagen DCF-invoercontract; null betekent nog niet ingesteld.';
