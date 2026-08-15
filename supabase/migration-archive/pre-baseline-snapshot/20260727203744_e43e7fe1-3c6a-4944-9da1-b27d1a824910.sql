-- Fase 2A.2: propositiemetadata op de Analysis-laag (real_estate_calculations)
ALTER TABLE public.real_estate_calculations
  ADD COLUMN IF NOT EXISTS proposition_type text,
  ADD COLUMN IF NOT EXISTS proposition_schema_version integer;

ALTER TABLE public.real_estate_calculations
  ALTER COLUMN proposition_type SET DEFAULT 'legacy_generic',
  ALTER COLUMN proposition_schema_version SET DEFAULT 1;

UPDATE public.real_estate_calculations
   SET proposition_type = 'legacy_generic'
 WHERE proposition_type IS NULL;

UPDATE public.real_estate_calculations
   SET proposition_schema_version = 1
 WHERE proposition_schema_version IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.real_estate_calculations'::regclass
      AND conname = 'real_estate_calculations_proposition_type_check'
  ) THEN
    ALTER TABLE public.real_estate_calculations
      ADD CONSTRAINT real_estate_calculations_proposition_type_check
      CHECK (proposition_type IN (
        'legacy_generic',
        'leased_investment',
        'vacant_commercial',
        'renovate_and_sell',
        'sell_off',
        'transformation',
        'demolition_newbuild',
        'rooftop_extension',
        'mixed_use',
        'portfolio',
        'leased_hotel',
        'operating_hotel',
        'land_development'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.real_estate_calculations'::regclass
      AND conname = 'real_estate_calculations_proposition_schema_version_check'
  ) THEN
    ALTER TABLE public.real_estate_calculations
      ADD CONSTRAINT real_estate_calculations_proposition_schema_version_check
      CHECK (proposition_schema_version > 0);
  END IF;
END $$;

ALTER TABLE public.real_estate_calculations
  ALTER COLUMN proposition_type SET NOT NULL,
  ALTER COLUMN proposition_schema_version SET NOT NULL;