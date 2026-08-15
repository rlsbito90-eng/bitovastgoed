-- 1. Leidend waarderingsspoor per scenario (auto, huur/BAR, scenario-exit, componentstrategie)
ALTER TABLE public.calculation_scenarios
  ADD COLUMN IF NOT EXISTS leading_valuation_track TEXT NOT NULL DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'calculation_scenarios'
      AND constraint_name = 'calculation_scenarios_leading_valuation_track_check'
  ) THEN
    ALTER TABLE public.calculation_scenarios
      ADD CONSTRAINT calculation_scenarios_leading_valuation_track_check
      CHECK (leading_valuation_track IN ('auto','huur_bar','scenario_exit','componentstrategie'));
  END IF;
END $$;

-- 2. Nieuwe toerekeningsmethode voor OVB per component: 'strategy'
--    Hiermee wordt de OVB-grondslag per component afgeleid uit de componentstrategie
--    (verkoop- of holdwaarde uit sell_off_units).
ALTER TYPE public.vr_ovb_allocation_method ADD VALUE IF NOT EXISTS 'strategy';
