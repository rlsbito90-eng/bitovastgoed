ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS archived_reason text;

CREATE INDEX IF NOT EXISTS idx_objecten_is_archived ON public.objecten (is_archived);
CREATE INDEX IF NOT EXISTS idx_deals_is_archived ON public.deals (is_archived);

-- Backfill: bestaande verkochte/ingetrokken objecten worden gearchiveerd
UPDATE public.objecten
   SET is_archived = true,
       archived_at = COALESCE(archived_at, updated_at, now()),
       archived_reason = COALESCE(archived_reason, CASE
         WHEN status = 'verkocht' THEN 'Verkocht'
         WHEN status = 'ingetrokken' THEN 'Ingetrokken'
         ELSE 'Gearchiveerd'
       END)
 WHERE is_archived = false
   AND status IN ('verkocht', 'ingetrokken');

UPDATE public.deals
   SET is_archived = true,
       archived_at = COALESCE(archived_at, updated_at, now()),
       archived_reason = COALESCE(archived_reason, CASE
         WHEN fase = 'afgerond' THEN 'Afgerond'
         WHEN fase = 'afgevallen' THEN 'Afgevallen'
         ELSE 'Gearchiveerd'
       END)
 WHERE is_archived = false
   AND fase IN ('afgerond', 'afgevallen');