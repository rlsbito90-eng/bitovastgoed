
-- Enums voor run-modus en run-status
DO $$ BEGIN
  CREATE TYPE public.off_market_run_modus AS ENUM ('test','sync','backfill','handmatig');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_run_status AS ENUM ('bezig','ok','fout','afgebroken');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Uitbreiding off_market_bronnen
ALTER TABLE public.off_market_bronnen
  ADD COLUMN IF NOT EXISTS auto_import boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_verwerken boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequentie text NOT NULL DEFAULT 'handmatig',
  ADD COLUMN IF NOT EXISTS dag_van_week smallint NULL,
  ADD COLUMN IF NOT EXISTS tijdstip_uur smallint NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS max_records_per_run int NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS normalize_batch_size int NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS lookback_days_default int NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS lookback_overlap_uren int NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS volgende_run_op timestamptz NULL,
  ADD COLUMN IF NOT EXISTS laatste_sync_op timestamptz NULL;

-- Check constraints (defensief, IF NOT EXISTS via DO-block)
DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_frequentie_chk
    CHECK (frequentie IN ('handmatig','dagelijks','wekelijks'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_dag_van_week_chk
    CHECK (dag_van_week IS NULL OR (dag_van_week BETWEEN 1 AND 7));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_tijdstip_uur_chk
    CHECK (tijdstip_uur BETWEEN 0 AND 23);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_max_records_chk
    CHECK (max_records_per_run BETWEEN 1 AND 5000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_normalize_batch_chk
    CHECK (normalize_batch_size BETWEEN 1 AND 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_lookback_days_chk
    CHECK (lookback_days_default BETWEEN 1 AND 365);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.off_market_bronnen
    ADD CONSTRAINT off_market_bronnen_lookback_overlap_chk
    CHECK (lookback_overlap_uren BETWEEN 0 AND 168);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nieuwe tabel off_market_import_runs
CREATE TABLE IF NOT EXISTS public.off_market_import_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bron_id uuid NOT NULL REFERENCES public.off_market_bronnen(id) ON DELETE CASCADE,
  modus public.off_market_run_modus NOT NULL,
  status public.off_market_run_status NOT NULL DEFAULT 'bezig',
  gestart_op timestamptz NOT NULL DEFAULT now(),
  afgerond_op timestamptz NULL,
  query_vanaf timestamptz NULL,
  query_tot timestamptz NULL,
  query_url text NULL,
  server_total int NULL,
  opgehaald int NOT NULL DEFAULT 0,
  nieuw int NOT NULL DEFAULT 0,
  dubbel int NOT NULL DEFAULT 0,
  verwerkt int NOT NULL DEFAULT 0,
  gepromoveerd int NOT NULL DEFAULT 0,
  merged int NOT NULL DEFAULT 0,
  geskipt int NOT NULL DEFAULT 0,
  cursor_start int NULL,
  cursor_eind int NULL,
  foutmelding text NULL,
  duration_ms int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS off_market_import_runs_bron_gestart_idx
  ON public.off_market_import_runs (bron_id, gestart_op DESC);
CREATE INDEX IF NOT EXISTS off_market_import_runs_modus_idx
  ON public.off_market_import_runs (modus);

-- Grants
GRANT SELECT ON public.off_market_import_runs TO authenticated;
GRANT ALL ON public.off_market_import_runs TO service_role;

-- RLS
ALTER TABLE public.off_market_import_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Intern leest off_market_import_runs"
    ON public.off_market_import_runs FOR SELECT
    TO authenticated
    USING (public.is_intern_gebruiker(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Geen INSERT/UPDATE/DELETE policies voor authenticated:
-- alleen service_role (edge functions) mag schrijven.

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_off_market_import_runs_updated ON public.off_market_import_runs;
CREATE TRIGGER trg_off_market_import_runs_updated
  BEFORE UPDATE ON public.off_market_import_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
