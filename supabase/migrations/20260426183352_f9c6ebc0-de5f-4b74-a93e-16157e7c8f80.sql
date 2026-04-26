
-- Tijd-velden op deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS bezichtiging_tijd TIME;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS follow_up_tijd TIME;

-- feed_tokens tabel
CREATE TABLE IF NOT EXISTS public.feed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  naam TEXT NOT NULL DEFAULT 'Agenda-feed',
  gebruiker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aangemaakt_op TIMESTAMPTZ NOT NULL DEFAULT now(),
  laatst_gebruikt TIMESTAMPTZ,
  ingetrokken_op TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feed_tokens_token ON public.feed_tokens(token) WHERE ingetrokken_op IS NULL;
CREATE INDEX IF NOT EXISTS idx_feed_tokens_gebruiker ON public.feed_tokens(gebruiker_id);

ALTER TABLE public.feed_tokens ENABLE ROW LEVEL SECURITY;

-- Gebruikers zien/beheren alleen eigen tokens
DROP POLICY IF EXISTS "feed_tokens_select_own" ON public.feed_tokens;
CREATE POLICY "feed_tokens_select_own" ON public.feed_tokens
  FOR SELECT TO authenticated USING (gebruiker_id = auth.uid());

DROP POLICY IF EXISTS "feed_tokens_insert_own" ON public.feed_tokens;
CREATE POLICY "feed_tokens_insert_own" ON public.feed_tokens
  FOR INSERT TO authenticated WITH CHECK (gebruiker_id = auth.uid());

DROP POLICY IF EXISTS "feed_tokens_update_own" ON public.feed_tokens;
CREATE POLICY "feed_tokens_update_own" ON public.feed_tokens
  FOR UPDATE TO authenticated USING (gebruiker_id = auth.uid()) WITH CHECK (gebruiker_id = auth.uid());

DROP POLICY IF EXISTS "feed_tokens_delete_own" ON public.feed_tokens;
CREATE POLICY "feed_tokens_delete_own" ON public.feed_tokens
  FOR DELETE TO authenticated USING (gebruiker_id = auth.uid());
