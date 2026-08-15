ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS potentie_omschrijving text,
  ADD COLUMN IF NOT EXISTS potentie_strategie text,
  ADD COLUMN IF NOT EXISTS potentie_extra_m2 numeric,
  ADD COLUMN IF NOT EXISTS potentie_extra_units integer,
  ADD COLUMN IF NOT EXISTS potentie_onderbouwing_status text,
  ADD COLUMN IF NOT EXISTS potentie_afhankelijkheden text,
  ADD COLUMN IF NOT EXISTS potentie_bron text;