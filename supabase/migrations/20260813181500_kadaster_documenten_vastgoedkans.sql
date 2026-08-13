ALTER TABLE public.kadaster_documenten
  ADD COLUMN IF NOT EXISTS vastgoedkans_id uuid
  REFERENCES public.vastgoedkansen(id) ON DELETE SET NULL;

ALTER TABLE public.kadaster_documenten
  DROP CONSTRAINT IF EXISTS kadaster_documenten_target_check;

ALTER TABLE public.kadaster_documenten
  ADD CONSTRAINT kadaster_documenten_target_check
  CHECK (object_id IS NOT NULL OR signaal_id IS NOT NULL OR vastgoedkans_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_kadaster_documenten_vastgoedkans_id
  ON public.kadaster_documenten(vastgoedkans_id)
  WHERE vastgoedkans_id IS NOT NULL;
