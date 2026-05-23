ALTER TABLE public.objecten
ADD COLUMN IF NOT EXISTS markeer_als_referentie boolean NOT NULL DEFAULT false;