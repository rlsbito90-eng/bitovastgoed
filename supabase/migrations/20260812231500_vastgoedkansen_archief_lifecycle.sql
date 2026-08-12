-- BUILD 2.0A.1 — uniforme lifecycle voor Vastgoedkansen.
-- Soft archive is de normale verwijdering uit de actieve werkvoorraad.

ALTER TABLE public.vastgoedkansen
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_reason text;

CREATE INDEX IF NOT EXISTS idx_vastgoedkansen_archived_at
  ON public.vastgoedkansen (archived_at);

CREATE INDEX IF NOT EXISTS idx_vastgoedkansen_actief_status
  ON public.vastgoedkansen (status, updated_at DESC)
  WHERE archived_at IS NULL;
