-- Alleen synthetische testgegevens in wegwerp-PostgreSQL.
INSERT INTO public.objecten(id,objectnaam,type_vastgoed) VALUES
 ('a1000000-0000-4000-8000-000000000001','Test Geuzenweg','wonen'),
 ('a1000000-0000-4000-8000-000000000002','Ander testobject','wonen');

-- Interne gebruiker simuleert een authentieke sessie met RLS.
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;

DO $verify$
DECLARE
  v_object uuid := 'a1000000-0000-4000-8000-000000000001'::uuid;
  v_other uuid := 'a1000000-0000-4000-8000-000000000002'::uuid;
  v_snapshot jsonb;
  v_saved jsonb;
  v_legacy_etag text;
  v_updated_etag text;
  v_first uuid;
  v_second uuid;
  v_error boolean;
BEGIN
  v_snapshot:=public.crm_object_adressen_snapshot(v_object);
  v_legacy_etag:=v_snapshot->>'etag';
  IF jsonb_array_length(v_snapshot->'adressen')<>0 THEN
    RAISE EXCEPTION 'Testobject is niet leeg';
  END IF;

  v_saved:=public.crm_object_adressen_opslaan(v_object,v_legacy_etag,
    jsonb_build_array(
      jsonb_build_object('adresregel','Geuzenweg 22A','plaats','Hilversum','postcode','1211 AB','is_hoofdadres',true),
      jsonb_build_object('adresregel','Geuzenweg 22B','plaats','Hilversum','postcode','1211 AB','is_hoofdadres',false)
    ));
  IF jsonb_array_length(v_saved->'adressen')<>2 THEN
    RAISE EXCEPTION 'Twee adressen niet opgeslagen';
  END IF;
  v_updated_etag:=v_saved->>'etag';
  IF v_updated_etag=v_legacy_etag THEN RAISE EXCEPTION 'ETag niet aangepast'; END IF;
  SELECT id INTO v_first FROM public.crm_object_adressen
    WHERE object_id=v_object AND adresregel='Geuzenweg 22A';
  SELECT id INTO v_second FROM public.crm_object_adressen
    WHERE object_id=v_object AND adresregel='Geuzenweg 22B';

  -- Save van een oud tabblad moet met een versieconflict stoppen.
  v_error:=false;
  BEGIN
    PERFORM public.crm_object_adressen_opslaan(v_object,v_legacy_etag,
      jsonb_build_array(jsonb_build_object('adresregel','Foute overschrijving 1','plaats','Hilversum','is_hoofdadres',true)));
  EXCEPTION WHEN serialization_failure THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Oude ETag is ten onrechte geaccepteerd'; END IF;

  -- Verkeerd hoofdadres en duplicaat mogen niet gedeeltelijk worden opgeslagen.
  v_error:=false;
  BEGIN
    PERFORM public.crm_object_adressen_opslaan(v_object,v_updated_etag,
      jsonb_build_array(
        jsonb_build_object('id',v_first,'adresregel','Geuzenweg 22A','plaats','Hilversum','is_hoofdadres',true),
        jsonb_build_object('id',v_second,'adresregel','Geuzenweg 22B','plaats','Hilversum','is_hoofdadres',true)
      ));
  EXCEPTION WHEN check_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Dubbel hoofdadres geaccepteerd'; END IF;
  IF (public.crm_object_adressen_snapshot(v_object)->>'etag')<>v_updated_etag THEN
    RAISE EXCEPTION 'Mislukte transactie wijzigde bestaande adressen';
  END IF;

  v_error:=false;
  BEGIN
    PERFORM public.crm_object_adressen_opslaan(v_other,
      public.crm_object_adressen_snapshot(v_other)->>'etag',
      jsonb_build_array(jsonb_build_object('id',v_first,'adresregel','Fout','plaats','Amsterdam','is_hoofdadres',true)));
  EXCEPTION WHEN foreign_key_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Adres-ID is over objectgrens gekopieerd'; END IF;

  -- Gekoppelde unit voorkomt archivering van dat adres.
  INSERT INTO public.crm_object_onderdelen
    (object_id,adres_id,naam,oppervlakte_m2,meetbasis)
    VALUES(v_object,v_second,'Appartement B',64,'gbo');
  v_error:=false;
  BEGIN
    PERFORM public.crm_object_adressen_opslaan(v_object,v_updated_etag,
      jsonb_build_array(
        jsonb_build_object('id',v_first,'adresregel','Geuzenweg 22A','plaats','Hilversum','is_hoofdadres',true)
      ));
  EXCEPTION WHEN foreign_key_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Actief unit-adres kon worden verwijderd'; END IF;

  -- Geldige wijziging houdt id, verhuureenheid en hoofdadres intact.
  v_saved:=public.crm_object_adressen_opslaan(v_object,v_updated_etag,
    jsonb_build_array(
      jsonb_build_object('id',v_first,'adresregel','Geuzenweg 22A','plaats','Hilversum','postcode','1211 AB','is_hoofdadres',false),
      jsonb_build_object('id',v_second,'adresregel','Geuzenweg 22B','plaats','Hilversum','postcode','1211 AB','is_hoofdadres',true)
    ));
  IF jsonb_array_length(v_saved->'adressen')<>2 THEN
    RAISE EXCEPTION 'Wettige wijziging heeft adressen verwijderd';
  END IF;
  IF (SELECT count(*) FROM public.crm_object_adressen
    WHERE object_id=v_object AND is_hoofdadres=true AND archived_at IS NULL)<>1 THEN
    RAISE EXCEPTION 'Niet exact één hoofdadres na wijziging';
  END IF;
  IF (SELECT count(*) FROM public.crm_object_onderdelen
    WHERE object_id=v_object AND adres_id=v_second)<>1 THEN
    RAISE EXCEPTION 'Gekoppeld objectonderdeel is verdwenen';
  END IF;
END $verify$;
RESET ROLE;

-- Niet-interne sessie mag geen toegang krijgen via de RPC's.
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $deny$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.crm_object_adressen_snapshot('a1000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Niet-interne gebruiker kon de snapshot lezen'; END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.crm_object_adressen_opslaan(
      'a1000000-0000-4000-8000-000000000001'::uuid,md5('[]'),'[]'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Niet-interne gebruiker kon opslaan'; END IF;
END $deny$;
RESET ROLE;
