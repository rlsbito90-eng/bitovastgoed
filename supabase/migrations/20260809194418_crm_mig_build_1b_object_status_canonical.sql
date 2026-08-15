ALTER TYPE public.object_status RENAME TO object_status_old;
CREATE TYPE public.object_status AS ENUM ('te_beoordelen','beschikbaar','on_hold','onder_optie','verkocht','ingetrokken','afgevallen');
ALTER TABLE public.objecten ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.objecten
  ALTER COLUMN status TYPE public.object_status
  USING (
    CASE status::text
      WHEN 'nieuw' THEN 'te_beoordelen'
      WHEN 'in_voorbereiding' THEN 'te_beoordelen'
      WHEN 'beschikbaar' THEN 'beschikbaar'
      WHEN 'in_onderhandeling' THEN 'onder_optie'
      WHEN 'verkocht' THEN 'verkocht'
      WHEN 'ingetrokken' THEN 'ingetrokken'
      ELSE 'te_beoordelen'
    END
  )::public.object_status;
ALTER TABLE public.objecten ALTER COLUMN status SET DEFAULT 'te_beoordelen'::public.object_status;
DROP TYPE public.object_status_old;