-- Fase 5A.1: AI-verrijking velden, indices en dealpotentie-view

-- Enum voor AI-status
DO $$ BEGIN
  CREATE TYPE public.off_market_ai_status AS ENUM ('niet_verrijkt','in_wachtrij','bezig','klaar','mislukt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Kolommen toevoegen
ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS ai_status public.off_market_ai_status NOT NULL DEFAULT 'niet_verrijkt',
  ADD COLUMN IF NOT EXISTS ai_score_componenten jsonb,
  ADD COLUMN IF NOT EXISTS ai_skip_reden text,
  ADD COLUMN IF NOT EXISTS ai_feedback smallint;

-- Indices
CREATE INDEX IF NOT EXISTS idx_off_market_signalen_ai_status_score
  ON public.off_market_signalen (ai_status, ai_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_off_market_ai_runs_input_hash
  ON public.off_market_ai_runs (input_hash);

-- Dealpotentie-view: gewogen ranking van actieve signalen
CREATE OR REPLACE VIEW public.view_off_market_dealpotentie AS
SELECT
  s.id,
  s.titel,
  s.plaats,
  s.provincie,
  s.assettype,
  s.status,
  s.prioriteit,
  s.ai_score,
  s.ai_verkoopkans,
  s.ai_strategie_suggestie,
  s.mogelijke_fee,
  s.ai_laatst_verrijkt_op,
  -- score * verkoopkans * log10(fee+10), genormaliseerd
  ROUND(
    COALESCE(s.ai_score, 0)::numeric
    * COALESCE(s.ai_verkoopkans, 0)::numeric
    * LOG(10, GREATEST(COALESCE(s.mogelijke_fee, 0)::numeric, 0) + 10)
  , 2) AS dealpotentie_score
FROM public.off_market_signalen s
WHERE s.gearchiveerd_op IS NULL
  AND s.ai_status = 'klaar'
ORDER BY dealpotentie_score DESC NULLS LAST;

GRANT SELECT ON public.view_off_market_dealpotentie TO authenticated;