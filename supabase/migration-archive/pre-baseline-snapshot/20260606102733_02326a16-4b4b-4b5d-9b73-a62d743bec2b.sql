
DO $$ BEGIN
  CREATE TYPE public.off_market_eigenaarstatus AS ENUM (
    'onbekend','te_onderzoeken','gevonden','benaderd','in_gesprek','niet_bereikbaar','geen_interesse'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_eigenaartype AS ENUM (
    'particulier','bv','stichting','vve','overheid','onbekend'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_eigenaarbron AS ENUM (
    'kadaster','kvk','google','linkedin','netwerk','anders'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS eigenaarstatus public.off_market_eigenaarstatus NOT NULL DEFAULT 'onbekend',
  ADD COLUMN IF NOT EXISTS eigenaar_naam text,
  ADD COLUMN IF NOT EXISTS eigenaar_type public.off_market_eigenaartype,
  ADD COLUMN IF NOT EXISTS eigenaar_bedrijfsnaam text,
  ADD COLUMN IF NOT EXISTS eigenaar_kvk text,
  ADD COLUMN IF NOT EXISTS eigenaar_telefoon text,
  ADD COLUMN IF NOT EXISTS eigenaar_email text,
  ADD COLUMN IF NOT EXISTS eigenaar_website text,
  ADD COLUMN IF NOT EXISTS eigenaar_linkedin text,
  ADD COLUMN IF NOT EXISTS kadastrale_aanduiding text,
  ADD COLUMN IF NOT EXISTS kadaster_check_op timestamptz,
  ADD COLUMN IF NOT EXISTS eigenaarbron public.off_market_eigenaarbron,
  ADD COLUMN IF NOT EXISTS eigenaar_onderzoek_notities text;

CREATE INDEX IF NOT EXISTS idx_off_market_signalen_eigenaarstatus
  ON public.off_market_signalen (eigenaarstatus);
