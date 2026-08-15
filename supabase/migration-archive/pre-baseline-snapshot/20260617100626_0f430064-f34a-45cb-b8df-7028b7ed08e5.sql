ALTER TABLE public.off_market_brieven
  ADD COLUMN IF NOT EXISTS archived_at      timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_reason  text        NULL;

CREATE INDEX IF NOT EXISTS off_market_brieven_signaal_active_idx
  ON public.off_market_brieven (signaal_id)
  WHERE archived_at IS NULL;