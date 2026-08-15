-- Fase 6C: eerste inhoudelijke standaardregister voor de quickscan.
--
-- Bronstatus:
-- - uitsluitend een formalisering van de reeds bestaande aannames in
--   src/lib/vastgoedrekenen/profiles.ts;
-- - geen externe marktbenchmark, taxatiekengetal of projectspecifieke raming;
-- - vóór een serieuze bieding vervangen door gecontroleerde externe of
--   projectspecifieke brondata.
--
-- Veiligheid:
-- - additief en idempotent;
-- - bestaande regels met dezelfde code worden niet overschreven;
-- - geen scenario, snapshot of financiële invoer wordt gewijzigd.

with asset_profiles (
  asset_key,
  asset_label,
  asset_type_codes,
  light_values,
  base_values,
  conservative_values
) as (
  values
    (
      'residentieel',
      'Residentieel',
      array['residential']::text[],
      '{"vacancy_percentage":1.5,"operating_cost_percentage":6,"maintenance_reserve_percentage":5,"management_cost_percentage":5}'::jsonb,
      '{"vacancy_percentage":4,"operating_cost_percentage":9,"maintenance_reserve_percentage":7,"management_cost_percentage":6.5}'::jsonb,
      '{"vacancy_percentage":6.5,"operating_cost_percentage":11,"maintenance_reserve_percentage":9,"management_cost_percentage":7.5}'::jsonb
    ),
    (
      'mixed_use',
      'Woon-/winkelpand of mixed-use',
      array['mixed_use']::text[],
      '{"vacancy_percentage":4,"operating_cost_percentage":8,"maintenance_reserve_percentage":6,"management_cost_percentage":6.5}'::jsonb,
      '{"vacancy_percentage":6.5,"operating_cost_percentage":10.5,"maintenance_reserve_percentage":8,"management_cost_percentage":7.5}'::jsonb,
      '{"vacancy_percentage":10,"operating_cost_percentage":13.5,"maintenance_reserve_percentage":10.5,"management_cost_percentage":8.5}'::jsonb
    ),
    (
      'retail',
      'Retail / winkelruimte en horeca',
      array['retail','hospitality']::text[],
      '{"vacancy_percentage":4,"operating_cost_percentage":9,"maintenance_reserve_percentage":6,"management_cost_percentage":6.5}'::jsonb,
      '{"vacancy_percentage":8.5,"operating_cost_percentage":11.5,"maintenance_reserve_percentage":8,"management_cost_percentage":7.5}'::jsonb,
      '{"vacancy_percentage":12.5,"operating_cost_percentage":14,"maintenance_reserve_percentage":10,"management_cost_percentage":8.5}'::jsonb
    ),
    (
      'kantoor',
      'Kantoor',
      array['office']::text[],
      '{"vacancy_percentage":6.5,"operating_cost_percentage":11,"maintenance_reserve_percentage":7,"management_cost_percentage":7.5}'::jsonb,
      '{"vacancy_percentage":10,"operating_cost_percentage":13.5,"maintenance_reserve_percentage":9,"management_cost_percentage":8.5}'::jsonb,
      '{"vacancy_percentage":15,"operating_cost_percentage":16.5,"maintenance_reserve_percentage":12,"management_cost_percentage":9.5}'::jsonb
    ),
    (
      'bedrijfsruimte',
      'Bedrijfsruimte / light industrial',
      array['light_industrial']::text[],
      '{"vacancy_percentage":3,"operating_cost_percentage":8,"maintenance_reserve_percentage":5,"management_cost_percentage":5.5}'::jsonb,
      '{"vacancy_percentage":5.5,"operating_cost_percentage":10,"maintenance_reserve_percentage":7,"management_cost_percentage":6.5}'::jsonb,
      '{"vacancy_percentage":8.5,"operating_cost_percentage":12,"maintenance_reserve_percentage":9,"management_cost_percentage":7.5}'::jsonb
    ),
    (
      'logistiek',
      'Logistiek',
      array['logistics']::text[],
      '{"vacancy_percentage":3,"operating_cost_percentage":6,"maintenance_reserve_percentage":4,"management_cost_percentage":4.5}'::jsonb,
      '{"vacancy_percentage":5,"operating_cost_percentage":8,"maintenance_reserve_percentage":6,"management_cost_percentage":5.5}'::jsonb,
      '{"vacancy_percentage":8,"operating_cost_percentage":10,"maintenance_reserve_percentage":8,"management_cost_percentage":6.5}'::jsonb
    ),
    (
      'zorg',
      'Zorgvastgoed',
      array['care']::text[],
      '{"vacancy_percentage":1,"operating_cost_percentage":9,"maintenance_reserve_percentage":7,"management_cost_percentage":6.5}'::jsonb,
      '{"vacancy_percentage":3.5,"operating_cost_percentage":11.5,"maintenance_reserve_percentage":9,"management_cost_percentage":7.5}'::jsonb,
      '{"vacancy_percentage":7.5,"operating_cost_percentage":14.5,"maintenance_reserve_percentage":12,"management_cost_percentage":8.5}'::jsonb
    )
),
metrics (scenario_field, code_slug, metric_label) as (
  values
    ('vacancy_percentage', 'leegstand', 'Leegstand'),
    ('operating_cost_percentage', 'exploitatiekosten', 'Exploitatiekosten'),
    ('maintenance_reserve_percentage', 'onderhoudsreserve', 'Onderhoudsreserve'),
    ('management_cost_percentage', 'beheerkosten', 'Beheerkosten')
),
seed_rows as (
  select
    'bito_quickscan_v1_' || asset_profiles.asset_key || '_' || metrics.code_slug as code,
    metrics.metric_label || ' — ' || asset_profiles.asset_label || ' quickscan' as naam,
    (asset_profiles.light_values ->> metrics.scenario_field)::numeric as minimum_waarde,
    (asset_profiles.base_values ->> metrics.scenario_field)::numeric as basis_waarde,
    (asset_profiles.conservative_values ->> metrics.scenario_field)::numeric as maximum_waarde,
    metrics.scenario_field,
    asset_profiles.asset_type_codes
  from asset_profiles
  cross join metrics
)
insert into public.vastgoedrekenen_kengetallen (
  code,
  naam,
  categorie,
  eenheid,
  minimum_waarde,
  basis_waarde,
  maximum_waarde,
  conservative_band,
  optimistic_band,
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
  toelichting,
  actief,
  versie,
  asset_type_codes,
  strategy_codes,
  project_phase_codes,
  risk_class_codes,
  quality_level_codes,
  complexity_codes,
  location_type_codes,
  market_condition_codes,
  scenario_profile_codes,
  location_keys,
  unit_code,
  vat_treatment_code,
  classification_schema_version
)
select
  seed_rows.code,
  seed_rows.naam,
  'exploitatie',
  '%',
  seed_rows.minimum_waarde,
  seed_rows.basis_waarde,
  seed_rows.maximum_waarde,
  'maximum',
  'minimum',
  seed_rows.scenario_field,
  'interne_werkhypothese',
  'Bito Vastgoed — bestaand aannameprofiel V1',
  'src/lib/vastgoedrekenen/profiles.ts (geformaliseerd in Fase 6C)',
  date '2026-07-30',
  date '2026-07-30',
  date '2027-01-30',
  array['Bito quickscan V1']::text[],
  '{}'::text[],
  array['quickscan']::text[],
  '{}'::text[],
  'laag',
  'Interne quickscanwerkhypothese uit het reeds bestaande CRM-profiel. Geen externe marktbenchmark. Controleer en vervang deze waarde vóór een serieuze bieding door actuele externe of projectspecifieke brondata. Het profiel zwaar/risicovol is bewust niet opgenomen in de automatische minimum-basis-maximumset.',
  true,
  1,
  seed_rows.asset_type_codes,
  '{}'::text[],
  array['quickscan']::text[],
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  array['conservative','base','optimistic']::text[],
  '{}'::text[],
  'percent',
  null,
  1
from seed_rows
on conflict (code) do nothing;
