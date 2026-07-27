-- Vastgoedrekenen Fase 2A.3 — registratieve renovatie- en projectvelden.
-- Additief, zonder backfill of automatische classificatie.

ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS renovation_area_m2 numeric,
  ADD COLUMN IF NOT EXISTS project_duration_months integer,
  ADD COLUMN IF NOT EXISTS temporary_project_income numeric,
  ADD COLUMN IF NOT EXISTS temporary_project_income_costs numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_renovation_area_nonnegative'
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_renovation_area_nonnegative
      CHECK (renovation_area_m2 IS NULL OR renovation_area_m2 >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_project_duration_positive'
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_project_duration_positive
      CHECK (project_duration_months IS NULL OR project_duration_months > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_temporary_income_nonnegative'
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_temporary_income_nonnegative
      CHECK (temporary_project_income IS NULL OR temporary_project_income >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calculation_scenarios_temporary_income_costs_nonnegative'
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_temporary_income_costs_nonnegative
      CHECK (temporary_project_income_costs IS NULL OR temporary_project_income_costs >= 0);
  END IF;
END $$;
