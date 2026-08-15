-- BUILD 2.0B.1 — Kadasterrecords als gedeelde bron voor Vastgoedkansen.
-- Additief en backward-compatible: bestaande object/signaal-records worden niet herschreven.

ALTER TABLE public.kadaster_data_records
  ADD COLUMN IF NOT EXISTS vastgoedkans_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kadaster_data_records_vastgoedkans_fk'
      AND conrelid = 'public.kadaster_data_records'::regclass
  ) THEN
    ALTER TABLE public.kadaster_data_records
      ADD CONSTRAINT kadaster_data_records_vastgoedkans_fk
      FOREIGN KEY (vastgoedkans_id)
      REFERENCES public.vastgoedkansen(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.kadaster_data_records
  VALIDATE CONSTRAINT kadaster_data_records_vastgoedkans_fk;

ALTER TABLE public.kadaster_data_records
  DROP CONSTRAINT IF EXISTS kadaster_data_records_target_check;

ALTER TABLE public.kadaster_data_records
  ADD CONSTRAINT kadaster_data_records_target_check
  CHECK (
    object_id IS NOT NULL
    OR signaal_id IS NOT NULL
    OR vastgoedkans_id IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.kadaster_data_records
  VALIDATE CONSTRAINT kadaster_data_records_target_check;

CREATE INDEX IF NOT EXISTS idx_kadaster_records_vastgoedkans_id
  ON public.kadaster_data_records(vastgoedkans_id)
  WHERE vastgoedkans_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kadaster_records_vastgoedkans_product_fetched
  ON public.kadaster_data_records(vastgoedkans_id, product_code, fetched_at DESC)
  WHERE vastgoedkans_id IS NOT NULL;