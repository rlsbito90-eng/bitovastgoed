-- Bito CRM — ATOMAIRE ADRESOPSLAG / ONTWERP, NIET PRODUCTIE-UITVOEREN.
-- Vereist: crm_object_adressen, crm_object_onderdelen en interne RLS (zie schema-ontwerp).
-- SECURITY INVOKER: alle autorisatie en RLS van de ingelogde gebruiker blijven gelden.
-- Mutatie schrijft uitsluitend naar crm_object_adressen, nooit naar objecten,
-- huuropbrengsten, vraagprijzen, dealhistorie of BAG.

CREATE OR REPLACE FUNCTION public.crm_object_adressen_snapshot(p_object_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_rows jsonb;
BEGIN
  IF NOT coalesce(public.is_intern_gebruiker((SELECT auth.uid())),false) THEN
    RAISE EXCEPTION 'Geen toegang tot adressen' USING ERRCODE='42501';
  END IF;
  IF p_object_id IS NULL THEN
    RAISE EXCEPTION 'Object-ID ontbreekt' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) INTO v_rows
    FROM public.crm_object_adressen a
    WHERE a.object_id=p_object_id AND a.archived_at IS NULL;
  RETURN jsonb_build_object('etag',md5(v_rows::text),'adressen',v_rows);
END
$fn$;

CREATE OR REPLACE FUNCTION public.crm_object_adressen_opslaan(
  p_object_id uuid,
  p_expected_etag text,
  p_adressen jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_entry jsonb;
  v_adresregel text;
  v_plaats text;
  v_postcode text;
  v_provincie text;
  v_id uuid;
  v_key text;
  v_keys text[] := ARRAY[]::text[];
  v_keep uuid[] := ARRAY[]::uuid[];
  v_primaries integer := 0;
  v_current_etag text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT coalesce(public.is_intern_gebruiker((SELECT auth.uid())),false) THEN
    RAISE EXCEPTION 'Geen toestemming om objectadressen te wijzigen' USING ERRCODE='42501';
  END IF;
  IF p_object_id IS NULL OR p_expected_etag IS NULL OR length(p_expected_etag)<>32 THEN
    RAISE EXCEPTION 'Object of versie ontbreekt' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_adressen) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_adressen) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Vul 1 tot 100 adressen in' USING ERRCODE='22023';
  END IF;

  -- Objectrij locken maakt gelijktijdige saves van hetzelfde object serieel.
  PERFORM 1 FROM public.objecten WHERE id=p_object_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Object ontbreekt of is niet toegankelijk' USING ERRCODE='23503';
  END IF;
  SELECT public.crm_object_adressen_snapshot(p_object_id)->>'etag' INTO v_current_etag;
  IF v_current_etag IS DISTINCT FROM p_expected_etag THEN
    RAISE EXCEPTION 'Adresgegevens zijn inmiddels gewijzigd. Vernieuw het dossier voor opslaan.'
      USING ERRCODE='40001';
  END IF;

  -- Eerst de COMPLETE payload valideren, vóór de eerste data-mutatie.
  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_adressen) LOOP
    IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Adres moet een geldig object zijn' USING ERRCODE='22023';
    END IF;
    v_adresregel:=btrim(coalesce(v_entry->>'adresregel',''));
    v_plaats:=btrim(coalesce(v_entry->>'plaats',''));
    v_postcode:=nullif(btrim(coalesce(v_entry->>'postcode','')),'');
    IF v_adresregel='' OR v_plaats='' THEN
      RAISE EXCEPTION 'Elk adres vereist een straat/huisnummer en plaats' USING ERRCODE='22023';
    END IF;
    IF jsonb_typeof(v_entry->'is_hoofdadres') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Hoofdadresstatus moet expliciet zijn' USING ERRCODE='22023';
    END IF;
    IF (v_entry->>'is_hoofdadres')::boolean THEN v_primaries:=v_primaries+1; END IF;

    v_key:=lower(regexp_replace(v_adresregel,'\s+',' ','g'))||'|'||
      lower(regexp_replace(coalesce(v_postcode,''),'\s+','','g'))||'|'||
      lower(regexp_replace(v_plaats,'\s+',' ','g'));
    IF v_key=ANY(v_keys) THEN
      RAISE EXCEPTION 'Dubbel adres in dezelfde invoer' USING ERRCODE='23505';
    END IF;
    v_keys:=array_append(v_keys,v_key);

    IF nullif(btrim(coalesce(v_entry->>'id','')),'') IS NOT NULL THEN
      BEGIN
        v_id:=(v_entry->>'id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Ongeldig adres-ID' USING ERRCODE='22023';
      END;
      IF v_id=ANY(v_keep) THEN
        RAISE EXCEPTION 'Adres-ID twee keer opgegeven' USING ERRCODE='23505';
      END IF;
      PERFORM 1 FROM public.crm_object_adressen
        WHERE id=v_id AND object_id=p_object_id AND archived_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Adres hoort niet bij dit object of is gearchiveerd' USING ERRCODE='23503';
      END IF;
      v_keep:=array_append(v_keep,v_id);
    END IF;
  END LOOP;
  IF v_primaries<>1 THEN
    RAISE EXCEPTION 'Selecteer precies één hoofdadres' USING ERRCODE='23514';
  END IF;

  -- Geen actief adresarchief zolang een actieve verhuur-/gebruiksunit ernaar verwijst.
  IF EXISTS (
    SELECT 1 FROM public.crm_object_onderdelen u
    JOIN public.crm_object_adressen a ON a.id=u.adres_id
    WHERE a.object_id=p_object_id AND a.archived_at IS NULL
      AND NOT (a.id=ANY(v_keep)) AND u.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Een verwijderd adres heeft nog actieve objectonderdelen'
      USING ERRCODE='23503';
  END IF;

  -- Maak eerst vorige hoofdadresvlaggen vrij voor de unieke partiële index.
  UPDATE public.crm_object_adressen SET is_hoofdadres=false,updated_at=v_now
    WHERE object_id=p_object_id AND archived_at IS NULL AND is_hoofdadres=true;
  UPDATE public.crm_object_adressen
    SET archived_at=v_now,updated_at=v_now
    WHERE object_id=p_object_id AND archived_at IS NULL
      AND NOT (id=ANY(v_keep));

  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_adressen) LOOP
    v_adresregel:=btrim(v_entry->>'adresregel');
    v_plaats:=btrim(v_entry->>'plaats');
    v_postcode:=nullif(btrim(coalesce(v_entry->>'postcode','')),'');
    v_provincie:=nullif(btrim(coalesce(v_entry->>'provincie','')),'');
    v_id:=nullif(btrim(coalesce(v_entry->>'id','')),'')::uuid;
    IF v_id IS NULL THEN
      INSERT INTO public.crm_object_adressen
        (object_id,adresregel,postcode,plaats,provincie,is_hoofdadres,updated_at,bron)
      VALUES (p_object_id,v_adresregel,v_postcode,v_plaats,v_provincie,
        (v_entry->>'is_hoofdadres')::boolean,v_now,'handmatig CRM');
    ELSE
      UPDATE public.crm_object_adressen SET
        adresregel=v_adresregel, postcode=v_postcode,
        plaats=v_plaats, provincie=v_provincie,
        is_hoofdadres=(v_entry->>'is_hoofdadres')::boolean,
        updated_at=v_now
      WHERE object_id=p_object_id AND id=v_id AND archived_at IS NULL;
    END IF;
  END LOOP;
  RETURN public.crm_object_adressen_snapshot(p_object_id);
END
$fn$;

-- PostgreSQL geeft nieuwe functies anders EXECUTE aan PUBLIC.
REVOKE ALL ON FUNCTION public.crm_object_adressen_snapshot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_object_adressen_opslaan(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_object_adressen_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_object_adressen_opslaan(uuid,text,jsonb) TO authenticated;
