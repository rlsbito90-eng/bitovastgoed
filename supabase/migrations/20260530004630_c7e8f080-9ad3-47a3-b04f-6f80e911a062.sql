
ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS buyer_fee_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notary_costs_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notary_costs_profile text;

ALTER TABLE public.calculation_scenarios
  DROP CONSTRAINT IF EXISTS calculation_scenarios_buyer_fee_method_check;
ALTER TABLE public.calculation_scenarios
  ADD CONSTRAINT calculation_scenarios_buyer_fee_method_check
  CHECK (buyer_fee_method IN ('staffel','percentage','amount','manual','zero'));

ALTER TABLE public.calculation_scenarios
  DROP CONSTRAINT IF EXISTS calculation_scenarios_notary_costs_method_check;
ALTER TABLE public.calculation_scenarios
  ADD CONSTRAINT calculation_scenarios_notary_costs_method_check
  CHECK (notary_costs_method IN ('profile','percentage','amount','manual','zero'));

ALTER TABLE public.calculation_scenarios
  DROP CONSTRAINT IF EXISTS calculation_scenarios_notary_costs_profile_check;
ALTER TABLE public.calculation_scenarios
  ADD CONSTRAINT calculation_scenarios_notary_costs_profile_check
  CHECK (notary_costs_profile IS NULL OR notary_costs_profile IN ('woning_simpel','woning_belegging','commercieel','mixed_use','portefeuille'));

COMMENT ON COLUMN public.calculation_scenarios.buyer_fee_method IS 'Methode voor aankoopfee: staffel (Bito), percentage, amount, manual (default voor bestaande), zero.';
COMMENT ON COLUMN public.calculation_scenarios.notary_costs_method IS 'Methode voor notariskosten: profile (quickscan), percentage, amount, manual (default voor bestaande), zero.';
