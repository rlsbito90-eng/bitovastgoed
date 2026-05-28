ALTER TABLE public.scenario_costs
  ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'geen',
  ADD COLUMN IF NOT EXISTS vat_percentage numeric,
  ADD COLUMN IF NOT EXISTS vat_amount_manual bigint;

-- Backfill: bestaande rijen met vat_applicable = true krijgen 21% btw-behandeling.
UPDATE public.scenario_costs
SET vat_treatment = 'pct_21',
    vat_percentage = 21
WHERE vat_applicable IS TRUE
  AND vat_treatment = 'geen';

-- Geldige waarden: 'geen', 'pct_21', 'pct_9', 'handmatig', 'verrekenbaar'.
ALTER TABLE public.scenario_costs
  DROP CONSTRAINT IF EXISTS scenario_costs_vat_treatment_check;
ALTER TABLE public.scenario_costs
  ADD CONSTRAINT scenario_costs_vat_treatment_check
  CHECK (vat_treatment IN ('geen','pct_21','pct_9','handmatig','verrekenbaar'));