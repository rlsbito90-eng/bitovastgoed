-- BUILD 2.0A.3 — één Acquisitieselectie voor Off-Market-signalen en Vastgoedkansen.
-- Bestaande signaalrecords blijven geldig; er wordt geen bronrecord aangemaakt of herschreven.

ALTER TABLE public.off_market_acquisitie_selectie
  ADD COLUMN IF NOT EXISTS vastgoedkans_id uuid;

ALTER TABLE public.off_market_acquisitie_selectie
  ALTER COLUMN signaal_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'off_market_acquisitie_selectie_vastgoedkans_fk'
      AND conrelid = 'public.off_market_acquisitie_selectie'::regclass
  ) THEN
    ALTER TABLE public.off_market_acquisitie_selectie
      ADD CONSTRAINT off_market_acquisitie_selectie_vastgoedkans_fk
      FOREIGN KEY (vastgoedkans_id)
      REFERENCES public.vastgoedkansen(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.off_market_acquisitie_selectie
  VALIDATE CONSTRAINT off_market_acquisitie_selectie_vastgoedkans_fk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'off_market_acquisitie_selectie_exact_een_bron'
      AND conrelid = 'public.off_market_acquisitie_selectie'::regclass
  ) THEN
    ALTER TABLE public.off_market_acquisitie_selectie
      ADD CONSTRAINT off_market_acquisitie_selectie_exact_een_bron
      CHECK (num_nonnulls(signaal_id, vastgoedkans_id) = 1)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.off_market_acquisitie_selectie
  VALIDATE CONSTRAINT off_market_acquisitie_selectie_exact_een_bron;

CREATE UNIQUE INDEX IF NOT EXISTS off_market_acquisitie_selectie_vastgoedkans_actief_uniek
  ON public.off_market_acquisitie_selectie (vastgoedkans_id)
  WHERE archived_at IS NULL AND vastgoedkans_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS off_market_acquisitie_selectie_vastgoedkans_idx
  ON public.off_market_acquisitie_selectie (vastgoedkans_id)
  WHERE vastgoedkans_id IS NOT NULL;