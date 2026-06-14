
ALTER TABLE public.off_market_bronnen DROP CONSTRAINT IF EXISTS off_market_bronnen_frequentie_chk;

ALTER TABLE public.off_market_bronnen
  ADD COLUMN IF NOT EXISTS backfill_vanaf date,
  ADD COLUMN IF NOT EXISTS backfill_tot date,
  ADD COLUMN IF NOT EXISTS backfill_cursor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_server_total integer,
  ADD COLUMN IF NOT EXISTS backfill_status text NOT NULL DEFAULT 'niet_gestart';

ALTER TABLE public.off_market_bronnen DROP CONSTRAINT IF EXISTS off_market_bronnen_backfill_status_chk;
ALTER TABLE public.off_market_bronnen
  ADD CONSTRAINT off_market_bronnen_backfill_status_chk
  CHECK (backfill_status IN ('niet_gestart','bezig','gepauzeerd','voltooid','fout'));

ALTER TABLE public.off_market_bronnen DROP CONSTRAINT IF EXISTS off_market_bronnen_backfill_cursor_chk;
ALTER TABLE public.off_market_bronnen
  ADD CONSTRAINT off_market_bronnen_backfill_cursor_chk
  CHECK (backfill_cursor >= 0);
