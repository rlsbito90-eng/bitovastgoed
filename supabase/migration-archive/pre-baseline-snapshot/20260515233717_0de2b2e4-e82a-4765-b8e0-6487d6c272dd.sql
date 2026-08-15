
-- 1. Nieuwe enum aanbiedingswijze
CREATE TYPE public.aanbiedingswijze AS ENUM ('off_market','stille_verkoop','openbaar','via_makelaar');

-- 2. Voeg kolom toe (default off_market)
ALTER TABLE public.objecten ADD COLUMN aanbiedingswijze public.aanbiedingswijze NOT NULL DEFAULT 'off_market';

-- Markeer oude 'nieuw' (= off-market in oude UI) records expliciet
UPDATE public.objecten SET aanbiedingswijze = 'off_market' WHERE status = 'nieuw';

-- 3. object_status enum vervangen
-- Stap a: hernoem oude type
ALTER TYPE public.object_status RENAME TO object_status_old;

-- Stap b: maak nieuw type
CREATE TYPE public.object_status AS ENUM ('te_beoordelen','beschikbaar','on_hold','onder_optie','verkocht','ingetrokken','afgevallen');

-- Stap c: zet kolom om via tekst met mapping
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

-- Stap d: drop oude type
DROP TYPE public.object_status_old;

-- 4. archived_note kolommen
ALTER TABLE public.objecten ADD COLUMN archived_note text;
ALTER TABLE public.deals ADD COLUMN archived_note text;

-- 5. Cleanup: archiveer bestaande verkocht/ingetrokken
UPDATE public.objecten
SET is_archived = true,
    archived_at = COALESCE(archived_at, now()),
    archived_reason = COALESCE(archived_reason,
      CASE status
        WHEN 'verkocht' THEN 'Verkocht via Bito Vastgoed'
        WHEN 'ingetrokken' THEN 'Ingetrokken door eigenaar'
      END)
WHERE status IN ('verkocht','ingetrokken') AND is_archived = false;
