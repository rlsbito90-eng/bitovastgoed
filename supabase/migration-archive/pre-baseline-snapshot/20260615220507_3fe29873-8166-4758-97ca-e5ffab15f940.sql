-- Geo-verrijking V1: officiële gemeente/wijk/buurt via PDOK Locatieserver
DO $$ BEGIN
  CREATE TYPE public.off_market_geo_status AS ENUM (
    'niet_verrijkt', 'verrijkt', 'geen_coordinaten', 'geen_match', 'fout'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS geo_gemeente_naam text,
  ADD COLUMN IF NOT EXISTS geo_gemeente_code text,
  ADD COLUMN IF NOT EXISTS geo_wijk_naam     text,
  ADD COLUMN IF NOT EXISTS geo_wijk_code     text,
  ADD COLUMN IF NOT EXISTS geo_buurt_naam    text,
  ADD COLUMN IF NOT EXISTS geo_buurt_code    text,
  ADD COLUMN IF NOT EXISTS geo_bron          text,
  ADD COLUMN IF NOT EXISTS geo_verrijkt_op   timestamptz,
  ADD COLUMN IF NOT EXISTS geo_status        public.off_market_geo_status NOT NULL DEFAULT 'niet_verrijkt',
  ADD COLUMN IF NOT EXISTS geo_foutmelding   text;

CREATE INDEX IF NOT EXISTS idx_off_market_signalen_geo_gemeente_code ON public.off_market_signalen(geo_gemeente_code);
CREATE INDEX IF NOT EXISTS idx_off_market_signalen_geo_wijk_code     ON public.off_market_signalen(geo_wijk_code);
CREATE INDEX IF NOT EXISTS idx_off_market_signalen_geo_buurt_code    ON public.off_market_signalen(geo_buurt_code);
CREATE INDEX IF NOT EXISTS idx_off_market_signalen_geo_status        ON public.off_market_signalen(geo_status);