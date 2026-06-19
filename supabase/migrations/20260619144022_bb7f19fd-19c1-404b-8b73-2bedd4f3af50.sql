-- V2.3 — BAG pre-check & Kadasteradvies (Fase 1)

-- 1) BAG-status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'off_market_bag_status') THEN
    CREATE TYPE public.off_market_bag_status AS ENUM (
      'niet_verrijkt',
      'bezig',
      'verrijkt',
      'geen_match',
      'meerdere_matches',
      'fout'
    );
  END IF;
END $$;

-- 2) Nieuwe kolommen op off_market_signalen (allemaal nullable / met defaults)
ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS bag_status public.off_market_bag_status NOT NULL DEFAULT 'niet_verrijkt',
  ADD COLUMN IF NOT EXISTS bag_totaal_oppervlakte_m2 integer,
  ADD COLUMN IF NOT EXISTS bag_aantal_panden integer,
  ADD COLUMN IF NOT EXISTS bag_aantal_vbo integer,
  ADD COLUMN IF NOT EXISTS bag_gebruiksdoelen text[],
  ADD COLUMN IF NOT EXISTS bag_bouwjaar integer,
  ADD COLUMN IF NOT EXISTS bag_pand_status text,
  ADD COLUMN IF NOT EXISTS bag_pand_ids text[],
  ADD COLUMN IF NOT EXISTS bag_vbo_ids text[],
  ADD COLUMN IF NOT EXISTS bag_match_kwaliteit text,
  ADD COLUMN IF NOT EXISTS bag_verrijkt_op timestamptz,
  ADD COLUMN IF NOT EXISTS bag_foutmelding text,
  ADD COLUMN IF NOT EXISTS bag_vbos jsonb,
  ADD COLUMN IF NOT EXISTS kadasteradvies text,
  ADD COLUMN IF NOT EXISTS kadasteradvies_reden text,
  ADD COLUMN IF NOT EXISTS kadasteradvies_berekend_op timestamptz;

-- 3) Index op bag_status voor toekomstige filtering / backfill-paneel (fase 2)
CREATE INDEX IF NOT EXISTS idx_off_market_signalen_bag_status
  ON public.off_market_signalen (bag_status);
