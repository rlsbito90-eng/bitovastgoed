ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS assumption_profile text DEFAULT 'conservatief',
  ADD COLUMN IF NOT EXISTS assumption_profile_reason text,
  ADD COLUMN IF NOT EXISTS assumptions_manual boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assumptions_source text,
  ADD COLUMN IF NOT EXISTS assumptions_reliability text DEFAULT 'middel',
  ADD COLUMN IF NOT EXISTS cost_structure text DEFAULT 'onbekend',
  ADD COLUMN IF NOT EXISTS incentive_reserve boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mjop_present text DEFAULT 'onbekend',
  ADD COLUMN IF NOT EXISTS contract_checked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_costs_checked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rent_source text DEFAULT 'handmatig';
ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS sale_strategy text,
  ADD COLUMN IF NOT EXISTS sale_price_total bigint,
  ADD COLUMN IF NOT EXISTS sale_price_per_m2 numeric,
  ADD COLUMN IF NOT EXISTS sale_price_per_unit bigint,
  ADD COLUMN IF NOT EXISTS sale_units_count integer,
  ADD COLUMN IF NOT EXISTS sale_sellable_m2 numeric,
  ADD COLUMN IF NOT EXISTS sale_costs_percentage numeric,
  ADD COLUMN IF NOT EXISTS sale_other_costs bigint,
  ADD COLUMN IF NOT EXISTS sale_exit_value_manual bigint,
  ADD COLUMN IF NOT EXISTS sale_target_margin_percentage numeric,
  ADD COLUMN IF NOT EXISTS sale_target_margin_amount bigint,
  ADD COLUMN IF NOT EXISTS sale_target_roi_percentage numeric,
  ADD COLUMN IF NOT EXISTS sale_target_exit_value bigint,
  ADD COLUMN IF NOT EXISTS sale_expected_period_months integer,
  ADD COLUMN IF NOT EXISTS bid_basis text;
ALTER TABLE public.scenario_costs
  ADD COLUMN IF NOT EXISTS amount_per_m2 numeric,
  ADD COLUMN IF NOT EXISTS m2_basis numeric,
  ADD COLUMN IF NOT EXISTS calc_mode text NOT NULL DEFAULT 'totaal';
ALTER TABLE public.calculation_scenarios ADD COLUMN IF NOT EXISTS sale_price_source text;
ALTER TABLE public.sell_off_units
  ADD COLUMN IF NOT EXISTS component_id uuid,
  ADD COLUMN IF NOT EXISTS unit_label text,
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS surface_gbo numeric,
  ADD COLUMN IF NOT EXISTS surface_vvo numeric,
  ADD COLUMN IF NOT EXISTS surface_bvo numeric,
  ADD COLUMN IF NOT EXISTS strategy text,
  ADD COLUMN IF NOT EXISTS sale_price_total bigint,
  ADD COLUMN IF NOT EXISTS sale_price_per_m2 numeric,
  ADD COLUMN IF NOT EXISTS sale_price_source text,
  ADD COLUMN IF NOT EXISTS sale_costs_pct numeric,
  ADD COLUMN IF NOT EXISTS sale_costs_amount bigint,
  ADD COLUMN IF NOT EXISTS legal_costs bigint,
  ADD COLUMN IF NOT EXISTS renovation_costs bigint,
  ADD COLUMN IF NOT EXISTS splitting_costs bigint,
  ADD COLUMN IF NOT EXISTS transformation_costs bigint,
  ADD COLUMN IF NOT EXISTS net_sale_proceeds bigint,
  ADD COLUMN IF NOT EXISTS hold_monthly_rent bigint,
  ADD COLUMN IF NOT EXISTS hold_annual_rent bigint,
  ADD COLUMN IF NOT EXISTS hold_rent_source text,
  ADD COLUMN IF NOT EXISTS hold_valuation_method text,
  ADD COLUMN IF NOT EXISTS hold_bar numeric,
  ADD COLUMN IF NOT EXISTS hold_nar numeric,
  ADD COLUMN IF NOT EXISTS hold_factor numeric,
  ADD COLUMN IF NOT EXISTS hold_value_manual bigint,
  ADD COLUMN IF NOT EXISTS hold_value_calculated bigint,
  ADD COLUMN IF NOT EXISTS contribution_to_scenario_value bigint,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.scenario_costs
  ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'geen',
  ADD COLUMN IF NOT EXISTS vat_percentage numeric,
  ADD COLUMN IF NOT EXISTS vat_amount_manual bigint;
UPDATE public.scenario_costs
SET vat_treatment = 'pct_21', vat_percentage = 21
WHERE vat_applicable IS TRUE AND vat_treatment = 'geen';
ALTER TABLE public.scenario_costs DROP CONSTRAINT IF EXISTS scenario_costs_vat_treatment_check;
ALTER TABLE public.scenario_costs ADD CONSTRAINT scenario_costs_vat_treatment_check CHECK (vat_treatment IN ('geen','pct_21','pct_9','handmatig','verrekenbaar'));
ALTER TABLE public.calculation_scenarios ADD COLUMN IF NOT EXISTS manual_zero_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.residential_wws_units ADD COLUMN IF NOT EXISTS wws_mode text;
ALTER TABLE public.calculation_scenarios ADD COLUMN IF NOT EXISTS wws_mode_default text;
ALTER TABLE public.calculation_scenarios ADD COLUMN IF NOT EXISTS leading_valuation_track TEXT NOT NULL DEFAULT 'auto';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='calculation_scenarios' AND constraint_name='calculation_scenarios_leading_valuation_track_check') THEN ALTER TABLE public.calculation_scenarios ADD CONSTRAINT calculation_scenarios_leading_valuation_track_check CHECK (leading_valuation_track IN ('auto','huur_bar','scenario_exit','componentstrategie')); END IF; END $$;
ALTER TYPE public.vr_ovb_allocation_method ADD VALUE IF NOT EXISTS 'strategy';
ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS buyer_fee_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notary_costs_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notary_costs_profile text;
ALTER TABLE public.calculation_scenarios DROP CONSTRAINT IF EXISTS calculation_scenarios_buyer_fee_method_check;
ALTER TABLE public.calculation_scenarios ADD CONSTRAINT calculation_scenarios_buyer_fee_method_check CHECK (buyer_fee_method IN ('staffel','percentage','amount','manual','zero'));
ALTER TABLE public.calculation_scenarios DROP CONSTRAINT IF EXISTS calculation_scenarios_notary_costs_method_check;
ALTER TABLE public.calculation_scenarios ADD CONSTRAINT calculation_scenarios_notary_costs_method_check CHECK (notary_costs_method IN ('profile','percentage','amount','manual','zero'));
ALTER TABLE public.calculation_scenarios DROP CONSTRAINT IF EXISTS calculation_scenarios_notary_costs_profile_check;
ALTER TABLE public.calculation_scenarios ADD CONSTRAINT calculation_scenarios_notary_costs_profile_check CHECK (notary_costs_profile IS NULL OR notary_costs_profile IN ('woning_simpel','woning_belegging','commercieel','mixed_use','portefeuille'));
COMMENT ON COLUMN public.calculation_scenarios.buyer_fee_method IS 'Methode voor aankoopfee: staffel (Bito), percentage, amount, manual (default voor bestaande), zero.';
COMMENT ON COLUMN public.calculation_scenarios.notary_costs_method IS 'Methode voor notariskosten: profile (quickscan), percentage, amount, manual (default voor bestaande), zero.';