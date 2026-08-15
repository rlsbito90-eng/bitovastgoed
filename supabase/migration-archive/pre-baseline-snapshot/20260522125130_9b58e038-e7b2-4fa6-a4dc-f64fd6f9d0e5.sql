
DO $$ BEGIN
  CREATE TYPE public.bieding_richting AS ENUM ('van_koper', 'van_verkoper', 'namens_verkoper', 'intern');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.biedingen
  ADD COLUMN IF NOT EXISTS richting public.bieding_richting NOT NULL DEFAULT 'van_koper';

UPDATE public.biedingen
  SET richting = 'van_verkoper'
  WHERE offer_type = 'tegenvoorstel' AND richting = 'van_koper';
