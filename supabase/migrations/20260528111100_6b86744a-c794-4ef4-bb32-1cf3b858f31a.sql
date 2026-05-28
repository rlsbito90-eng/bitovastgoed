ALTER TABLE public.residential_wws_units ADD COLUMN IF NOT EXISTS wws_mode text;
ALTER TABLE public.calculation_scenarios ADD COLUMN IF NOT EXISTS wws_mode_default text;