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