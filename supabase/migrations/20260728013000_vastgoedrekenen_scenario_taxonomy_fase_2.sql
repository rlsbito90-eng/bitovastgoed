-- Vastgoedrekenen — scenario-taxonomie Fase 2
-- Additief schema naast de bestaande legacyvelden.
-- Bewust geen UPDATE, backfill, default of automatische conversie van bestaande records.

ALTER TABLE public.real_estate_calculations
  ADD COLUMN IF NOT EXISTS analysis_question text,
  ADD COLUMN IF NOT EXISTS valuation_date date,
  ADD COLUMN IF NOT EXISTS time_horizon_months integer;

ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS business_case text,
  ADD COLUMN IF NOT EXISTS intervention text,
  ADD COLUMN IF NOT EXISTS expansion_subtype text,
  ADD COLUMN IF NOT EXISTS exploitation_mode text,
  ADD COLUMN IF NOT EXISTS disposition text,
  ADD COLUMN IF NOT EXISTS taxonomy_schema_version integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_estate_calculations_analysis_question_check'
      AND conrelid = 'public.real_estate_calculations'::regclass
  ) THEN
    ALTER TABLE public.real_estate_calculations
      ADD CONSTRAINT real_estate_calculations_analysis_question_check
      CHECK (
        analysis_question IS NULL
        OR length(btrim(analysis_question)) BETWEEN 1 AND 2000
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_estate_calculations_time_horizon_check'
      AND conrelid = 'public.real_estate_calculations'::regclass
  ) THEN
    ALTER TABLE public.real_estate_calculations
      ADD CONSTRAINT real_estate_calculations_time_horizon_check
      CHECK (
        time_horizon_months IS NULL
        OR time_horizon_months BETWEEN 1 AND 1200
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_business_case_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_business_case_check
      CHECK (
        business_case IS NULL OR business_case IN (
          'legacy_generic',
          'income_investment',
          'value_add',
          'redevelopment',
          'new_development',
          'land_development',
          'portfolio_optimization',
          'operating_asset',
          'capital_restructuring',
          'asset_disposal'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_intervention_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_intervention_check
      CHECK (
        intervention IS NULL OR intervention IN (
          'none',
          'maintain',
          'renovate',
          'sustainability_upgrade',
          'split',
          'transform',
          'expand',
          'demolish_newbuild',
          'site_development'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_expansion_subtype_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_expansion_subtype_check
      CHECK (
        expansion_subtype IS NULL OR expansion_subtype IN (
          'rooftop_addition',
          'horizontal_extension',
          'new_volume_on_plot',
          'interior_densification',
          'other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_exploitation_mode_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_exploitation_mode_check
      CHECK (
        exploitation_mode IS NULL OR exploitation_mode IN (
          'vacant',
          'rental',
          'owner_occupied',
          'operating_business',
          'temporary_use',
          'mixed',
          'undecided'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_disposition_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_disposition_check
      CHECK (
        disposition IS NULL OR disposition IN (
          'hold',
          'sell_as_whole',
          'sell_unit',
          'sell_component',
          'sale_and_leaseback',
          'deferred',
          'undecided'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_taxonomy_schema_version_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_taxonomy_schema_version_check
      CHECK (taxonomy_schema_version IS NULL OR taxonomy_schema_version > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_expansion_consistency_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_expansion_consistency_check
      CHECK (expansion_subtype IS NULL OR intervention = 'expand');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_taxonomy_atomic_check'
      AND conrelid = 'public.calculation_scenarios'::regclass
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_taxonomy_atomic_check
      CHECK (
        (
          taxonomy_schema_version IS NULL
          AND business_case IS NULL
          AND intervention IS NULL
          AND expansion_subtype IS NULL
          AND exploitation_mode IS NULL
          AND disposition IS NULL
        )
        OR
        (
          taxonomy_schema_version IS NOT NULL
          AND business_case IS NOT NULL
          AND intervention IS NOT NULL
          AND exploitation_mode IS NOT NULL
          AND disposition IS NOT NULL
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.real_estate_calculations.analysis_question IS
  'Centrale vraag van de Quickscan; metadata en geen financiële invoer.';
COMMENT ON COLUMN public.real_estate_calculations.valuation_date IS
  'Peildatum van de analyse; nog niet automatisch gekoppeld aan waarderingsformules.';
COMMENT ON COLUMN public.real_estate_calculations.time_horizon_months IS
  'Beschouwde tijdshorizon in maanden; voorbereiding voor tijdsafhankelijke modellen.';

COMMENT ON COLUMN public.calculation_scenarios.business_case IS
  'Canonieke businesscase naast strategy_type; nullable totdat expliciet geclassificeerd.';
COMMENT ON COLUMN public.calculation_scenarios.intervention IS
  'Canonieke fysieke ingreep; commerciële acties en financiering vallen hier niet onder.';
COMMENT ON COLUMN public.calculation_scenarios.expansion_subtype IS
  'Subtype van intervention=expand, waaronder rooftop_addition (optoppen).';
COMMENT ON COLUMN public.calculation_scenarios.exploitation_mode IS
  'Exploitatievorm van het scenario, onafhankelijk van disposition.';
COMMENT ON COLUMN public.calculation_scenarios.disposition IS
  'Aanhoud-/verkoopvorm, onafhankelijk van bezetting en financiering.';
COMMENT ON COLUMN public.calculation_scenarios.taxonomy_schema_version IS
  'Versie van de expliciet opgeslagen canonieke scenario-taxonomie; null betekent legacy-read.';
