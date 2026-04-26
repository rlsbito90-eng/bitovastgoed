ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS referentieanalyse_zichtbaar boolean NOT NULL DEFAULT true;