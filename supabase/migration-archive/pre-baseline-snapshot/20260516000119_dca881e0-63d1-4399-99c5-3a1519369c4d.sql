ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Backfill: voor bestaande afgeronde deals zonder closed_at, gebruik archived_at of updated_at
UPDATE public.deals
SET closed_at = COALESCE(archived_at, updated_at)
WHERE fase = 'afgerond' AND closed_at IS NULL;