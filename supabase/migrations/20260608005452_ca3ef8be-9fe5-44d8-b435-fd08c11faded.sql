
-- Enums
DO $$ BEGIN
  CREATE TYPE public.off_market_kadaster_modus AS ENUM ('mock','handmatig','api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_kadaster_status AS ENUM ('geslaagd','geen_resultaat','meerdere_resultaten','mislukt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Audit-tabel
CREATE TABLE IF NOT EXISTS public.off_market_kadaster_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signaal_id uuid NOT NULL REFERENCES public.off_market_signalen(id) ON DELETE CASCADE,
  uitgevoerd_door uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uitgevoerd_op timestamptz NOT NULL DEFAULT now(),
  modus public.off_market_kadaster_modus NOT NULL,
  zoekvariant text,
  zoekterm jsonb,
  status public.off_market_kadaster_status NOT NULL,
  match_confidence numeric(3,2),
  resultaten jsonb NOT NULL DEFAULT '[]'::jsonb,
  gekozen_resultaat jsonb,
  overgenomen_op timestamptz,
  foutmelding text,
  kosten_eurocent integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omkc_signaal ON public.off_market_kadaster_checks(signaal_id, uitgevoerd_op DESC);

GRANT SELECT, INSERT, UPDATE ON public.off_market_kadaster_checks TO authenticated;
GRANT ALL ON public.off_market_kadaster_checks TO service_role;

ALTER TABLE public.off_market_kadaster_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne gebruikers kunnen kadaster-checks bekijken"
  ON public.off_market_kadaster_checks FOR SELECT
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-checks aanmaken"
  ON public.off_market_kadaster_checks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-checks bijwerken"
  ON public.off_market_kadaster_checks FOR UPDATE
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()))
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_omkc_updated_at
  BEFORE UPDATE ON public.off_market_kadaster_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
