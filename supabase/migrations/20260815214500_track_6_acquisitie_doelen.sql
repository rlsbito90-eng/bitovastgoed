-- TRACK-6 — acquisitie actuals versus bestaande doelen
-- Geen nieuw doelmodel: jaar_doelen en acquisitie_campagnes blijven bron van waarheid.

ALTER TABLE public.jaar_doelen
  ADD COLUMN IF NOT EXISTS acquisitie_brieven_doel integer,
  ADD COLUMN IF NOT EXISTS acquisitie_responspercentage_doel numeric(5,2),
  ADD COLUMN IF NOT EXISTS acquisitie_positieve_responspercentage_doel numeric(5,2),
  ADD COLUMN IF NOT EXISTS acquisitie_kadaster_aanvragen_doel integer,
  ADD COLUMN IF NOT EXISTS acquisitie_kadaster_budget_doel numeric(12,2);

DO $$ BEGIN
  ALTER TABLE public.jaar_doelen
    ADD CONSTRAINT jaar_doelen_acquisitie_brieven_doel_check
    CHECK (acquisitie_brieven_doel IS NULL OR acquisitie_brieven_doel >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.jaar_doelen
    ADD CONSTRAINT jaar_doelen_acquisitie_responspercentage_doel_check
    CHECK (acquisitie_responspercentage_doel IS NULL OR acquisitie_responspercentage_doel BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.jaar_doelen
    ADD CONSTRAINT jaar_doelen_acquisitie_positieve_responspercentage_doel_check
    CHECK (acquisitie_positieve_responspercentage_doel IS NULL OR acquisitie_positieve_responspercentage_doel BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.jaar_doelen
    ADD CONSTRAINT jaar_doelen_acquisitie_kadaster_aanvragen_doel_check
    CHECK (acquisitie_kadaster_aanvragen_doel IS NULL OR acquisitie_kadaster_aanvragen_doel >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.jaar_doelen
    ADD CONSTRAINT jaar_doelen_acquisitie_kadaster_budget_doel_check
    CHECK (acquisitie_kadaster_budget_doel IS NULL OR acquisitie_kadaster_budget_doel >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.acquisitie_campagnes
  ADD COLUMN IF NOT EXISTS doel_aantal_targets integer;

DO $$ BEGIN
  ALTER TABLE public.acquisitie_campagnes
    ADD CONSTRAINT acquisitie_campagnes_doel_aantal_targets_check
    CHECK (doel_aantal_targets IS NULL OR doel_aantal_targets >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.jaar_doelen.acquisitie_brieven_doel IS
  'Jaarlijks doel voor automatisch geregistreerde verzonden acquisitiecommunicaties.';
COMMENT ON COLUMN public.jaar_doelen.acquisitie_responspercentage_doel IS
  'Jaarlijks responsdoel als percentage van verzonden acquisitiecommunicaties.';
COMMENT ON COLUMN public.jaar_doelen.acquisitie_positieve_responspercentage_doel IS
  'Jaarlijks doel voor positieve reacties als percentage van verzonden acquisitiecommunicaties.';
COMMENT ON COLUMN public.jaar_doelen.acquisitie_kadaster_aanvragen_doel IS
  'Jaarlijks doel/bovengrens voor geregistreerde Kadaster-aanvragen binnen acquisitie.';
COMMENT ON COLUMN public.jaar_doelen.acquisitie_kadaster_budget_doel IS
  'Jaarlijks Kadasterbudget voor acquisitie; actual gebruikt beste beschikbare kostenbron.';
COMMENT ON COLUMN public.acquisitie_campagnes.doel_aantal_targets IS
  'Campagnedoel voor het aantal expliciet aan deze campagne gekoppelde acquisitietargets.';
