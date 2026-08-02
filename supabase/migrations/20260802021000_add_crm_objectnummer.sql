-- BUILD A1 — CRM-breed onveranderlijk objectnummer
-- Additief: bestaande UUID's en interne referentienummers blijven ongewijzigd.

CREATE SEQUENCE IF NOT EXISTS public.crm_objectnummer_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.next_crm_objectnummer()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'OBJ-' || lpad(nextval('public.crm_objectnummer_seq')::text, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.next_crm_objectnummer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_crm_objectnummer() TO authenticated, service_role;

ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS crm_objectnummer text;

ALTER TABLE public.objecten
  ALTER COLUMN crm_objectnummer SET DEFAULT public.next_crm_objectnummer();

ALTER SEQUENCE public.crm_objectnummer_seq
  OWNED BY public.objecten.crm_objectnummer;

-- Synchroniseer de sequence eerst met eventueel reeds uitgegeven nummers en vul
-- vervolgens ontbrekende nummers deterministisch op created_at/id aan.
DO $$
DECLARE
  object_row record;
  highest_number bigint := 0;
BEGIN
  SELECT COALESCE(MAX(substring(crm_objectnummer FROM 5)::bigint), 0)
    INTO highest_number
  FROM public.objecten
  WHERE crm_objectnummer ~ '^OBJ-[0-9]{6,}$';

  IF highest_number > 0 THEN
    PERFORM setval('public.crm_objectnummer_seq', highest_number, true);
  ELSE
    PERFORM setval('public.crm_objectnummer_seq', 1, false);
  END IF;

  FOR object_row IN
    SELECT id
    FROM public.objecten
    WHERE crm_objectnummer IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.objecten
    SET crm_objectnummer = public.next_crm_objectnummer()
    WHERE id = object_row.id
      AND crm_objectnummer IS NULL;
  END LOOP;

  SELECT COALESCE(MAX(substring(crm_objectnummer FROM 5)::bigint), 0)
    INTO highest_number
  FROM public.objecten
  WHERE crm_objectnummer ~ '^OBJ-[0-9]{6,}$';

  IF highest_number > 0 THEN
    PERFORM setval('public.crm_objectnummer_seq', highest_number, true);
  ELSE
    PERFORM setval('public.crm_objectnummer_seq', 1, false);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.objecten'::regclass
      AND conname = 'objecten_crm_objectnummer_format_check'
  ) THEN
    ALTER TABLE public.objecten
      ADD CONSTRAINT objecten_crm_objectnummer_format_check
      CHECK (crm_objectnummer ~ '^OBJ-[0-9]{6,}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS objecten_crm_objectnummer_key
  ON public.objecten (crm_objectnummer);

ALTER TABLE public.objecten
  ALTER COLUMN crm_objectnummer SET NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_crm_objectnummer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Een ontbrekend nummer mag door een gecontroleerde herstelactie worden gezet;
  -- een eenmaal uitgegeven nummer is daarna onveranderlijk.
  IF OLD.crm_objectnummer IS NOT NULL
     AND NEW.crm_objectnummer IS DISTINCT FROM OLD.crm_objectnummer THEN
    RAISE EXCEPTION 'crm_objectnummer is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS objecten_crm_objectnummer_immutable ON public.objecten;
CREATE TRIGGER objecten_crm_objectnummer_immutable
BEFORE UPDATE OF crm_objectnummer ON public.objecten
FOR EACH ROW
EXECUTE FUNCTION public.prevent_crm_objectnummer_update();

COMMENT ON COLUMN public.objecten.crm_objectnummer IS
  'Blijvend, app-breed leesbaar CRM-objectnummer; onafhankelijk van adres, assettype en externe bronidentifiers.';
