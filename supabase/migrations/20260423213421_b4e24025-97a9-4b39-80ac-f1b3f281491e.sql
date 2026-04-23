ALTER TABLE public.referentie_objecten
  ADD COLUMN IF NOT EXISTS huurprijs_per_maand bigint,
  ADD COLUMN IF NOT EXISTS huurprijs_per_jaar bigint;