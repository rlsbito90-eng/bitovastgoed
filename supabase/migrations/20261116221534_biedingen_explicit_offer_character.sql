-- Separate the bid's commercial character from offer_type and communication channel.
-- Nullable: existing bids are preserved and never silently reclassified.
ALTER TABLE public.biedingen
  ADD COLUMN IF NOT EXISTS bod_karakter text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'biedingen_bod_karakter_check'
      AND conrelid = 'public.biedingen'::regclass
  ) THEN
    ALTER TABLE public.biedingen
      ADD CONSTRAINT biedingen_bod_karakter_check
      CHECK (bod_karakter IS NULL OR bod_karakter IN ('indicatief', 'formeel'));
  END IF;
END
$$;

COMMENT ON COLUMN public.biedingen.bod_karakter IS
  'Expliciete classificatie: indicatief of formeel. NULL = niet vastgelegd, ook voor historische records. Onafhankelijk van schriftelijk/mondeling en financieringsvoorbehoud.';
