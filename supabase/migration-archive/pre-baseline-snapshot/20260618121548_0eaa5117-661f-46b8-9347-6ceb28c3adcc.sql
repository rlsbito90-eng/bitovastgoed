-- 1. Extra velden op off_market_brieven (additief, backward compatible)
ALTER TABLE public.off_market_brieven
  ADD COLUMN IF NOT EXISTS kanaal text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS campagne_stap text NULL,
  ADD COLUMN IF NOT EXISTS geadresseerde_key text NULL,
  ADD COLUMN IF NOT EXISTS printdatum date NULL,
  ADD COLUMN IF NOT EXISTS postdatum date NULL,
  ADD COLUMN IF NOT EXISTS verzendstatus text NOT NULL DEFAULT 'concept',
  ADD COLUMN IF NOT EXISTS opvolgdatum date NULL,
  ADD COLUMN IF NOT EXISTS gekoppelde_taak_id uuid NULL REFERENCES public.taken(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsstatus text NULL,
  ADD COLUMN IF NOT EXISTS responsdatum date NULL,
  ADD COLUMN IF NOT EXISTS respons_kanaal text NULL,
  ADD COLUMN IF NOT EXISTS respons_samenvatting text NULL;

CREATE INDEX IF NOT EXISTS idx_off_market_brieven_signaal_geadresseerde
  ON public.off_market_brieven (signaal_id, geadresseerde_key);
CREATE INDEX IF NOT EXISTS idx_off_market_brieven_signaal_opvolgdatum
  ON public.off_market_brieven (signaal_id, opvolgdatum);

-- 2. Audittabel off_market_brief_events
CREATE TABLE IF NOT EXISTS public.off_market_brief_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signaal_id uuid NOT NULL REFERENCES public.off_market_signalen(id) ON DELETE CASCADE,
  brief_id uuid NULL REFERENCES public.off_market_brieven(id) ON DELETE CASCADE,
  geadresseerde_key text NULL,
  campagne_stap text NULL,
  kanaal text NULL,
  event_type text NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  status text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_off_market_brief_events_signaal
  ON public.off_market_brief_events (signaal_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_off_market_brief_events_brief
  ON public.off_market_brief_events (brief_id, event_date DESC);

GRANT SELECT, INSERT ON public.off_market_brief_events TO authenticated;
GRANT ALL ON public.off_market_brief_events TO service_role;

ALTER TABLE public.off_market_brief_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne gebruikers lezen briefevents"
  ON public.off_market_brief_events
  FOR SELECT
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers insert briefevents"
  ON public.off_market_brief_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
-- Bewust geen UPDATE/DELETE policies → append-only audit trail.