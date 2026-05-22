ALTER TABLE public.scenario_costs
  ADD COLUMN IF NOT EXISTS amount_per_m2 numeric,
  ADD COLUMN IF NOT EXISTS m2_basis numeric,
  ADD COLUMN IF NOT EXISTS calc_mode text NOT NULL DEFAULT 'totaal';

ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS sale_price_source text;