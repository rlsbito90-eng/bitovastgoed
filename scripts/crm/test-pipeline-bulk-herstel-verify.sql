-- Alleen tijdelijke PostgreSQL 17 in GitHub Actions.
-- Vereist de geslaagde originele bulk-verificatie en haar fictieve records.
-- Test compensatie als NIEUWE transactie, met onveranderde oorspronkelijke audit.

CREATE FUNCTION public.crm_bulk_test_fout_in_herstel_audit() RETURNS trigger
LANGUAGE plpgsql AS $trigger$
BEGIN
  IF current_setting('crm_test.fail_herstel',true)='on'
     AND NEW.kandidaat_id='b2000000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Geforceerde herstel-auditfout' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$trigger$;
CREATE TRIGGER crm_bulk_test_fout_in_herstel_audit
  BEFORE INSERT ON public.crm_pipeline_bulk_herstel_audit
  FOR EACH ROW EXECUTE FUNCTION public.crm_bulk_test_fout_in_herstel_audit();

SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $verify_herstel$
DECLARE
  v_object uuid := 'b1000000-0000-4000-8000-000000000001';
  v_a uuid := 'b2000000-0000-4000-8000-000000000001';
  v_b uuid := 'b2000000-0000-4000-8000-000000000002';
  v_c uuid := 'b2000000-0000-4000-8000-000000000003';
  v_bron uuid := 'b4000000-0000-4000-8000-000000000009';
  v_herstel uuid := 'b4000000-0000-4000-8000-000000000020';
  v_result jsonb;
  v_a_version timestamptz;
  v_c_version timestamptz;
  v_b_version timestamptz;
  v_error boolean;
BEGIN
  -- 1: Originele interne bulkafwijzing A+C met één hersteltransactie terug.
  IF (SELECT count(*) FROM public.object_pipeline
      WHERE id=ANY(ARRAY[v_a,v_c]) AND pipeline_fase='afgevallen')<>2 THEN
    RAISE EXCEPTION 'Originele testbulk ontbreekt';
  END IF;
  v_result:=public.crm_pipeline_bulk_herstellen(v_object,v_bron,v_herstel);
  IF v_result->>'hersteld'<>'2'
     OR jsonb_array_length(v_result->'wijzigingen')<>2 THEN
    RAISE EXCEPTION 'Twee kandidaten niet hersteld: %',v_result;
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.object_pipeline
     WHERE id=v_a AND pipeline_fase='informatie_gedeeld'
       AND interesse_niveau='lauw' AND reden_afgevallen IS NULL
  ) OR NOT EXISTS(
    SELECT 1 FROM public.object_pipeline
     WHERE id=v_c AND pipeline_fase='bezichtiging_gepland'
       AND interesse_niveau='lauw' AND reden_afgevallen IS NULL
  ) THEN RAISE EXCEPTION 'Originele waarden zijn niet exact hersteld'; END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit WHERE request_id=v_bron)<>2
     OR (SELECT count(*) FROM public.crm_pipeline_bulk_herstel_audit
         WHERE bron_request_id=v_bron)<>2 THEN
    RAISE EXCEPTION 'Bronhistorie verwijderd of herstelhistorie ontbreekt';
  END IF;
  IF public.crm_pipeline_bulk_herstellen(v_object,v_bron,v_herstel)<>v_result THEN
    RAISE EXCEPTION 'Herhaalde herstelactie met zelfde ID niet idempotent';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_herstel_audit
      WHERE bron_request_id=v_bron)<>2 THEN
    RAISE EXCEPTION 'Retry schreef dubbele herstel-audit';
  END IF;

  -- 2: Twee keer herstellen met een verschillend herstel-ID moet falen.
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(
      v_object,v_bron,'b4000000-0000-4000-8000-000000000021');
  EXCEPTION WHEN unique_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Tweede herstel met andere ID toegestaan'; END IF;

  -- 3: Ook met het succesvolle herstel-ID mag geen andere bron worden hersteld.
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(
      v_object,'b4000000-0000-4000-8000-000000000002',v_herstel);
  EXCEPTION WHEN unique_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Hergebruikt herstel-ID met andere bron toegestaan'; END IF;

  -- 4: Eerst nieuwe groepsactie A+C, daarna handmatige wijziging in C.
  -- Verouderd herstel zou A wel mogen zien, maar moet A én C volledig ongemoeid laten.
  SELECT updated_at INTO v_a_version FROM public.object_pipeline WHERE id=v_a;
  SELECT updated_at INTO v_c_version FROM public.object_pipeline WHERE id=v_c;
  v_result:=public.crm_pipeline_bulk_opslaan(
    v_object,'b4000000-0000-4000-8000-000000000022',
    jsonb_build_array(
      jsonb_build_object('id',v_a,'expected_updated_at',v_a_version),
      jsonb_build_object('id',v_c,'expected_updated_at',v_c_version)
    ),'{"type":"interesse","niveau":"warm"}'::jsonb
  );
  IF v_result->>'aangepast'<>'2' THEN
    RAISE EXCEPTION 'Tweede groep A+C niet opgeslagen';
  END IF;
  UPDATE public.object_pipeline
    SET interesse_niveau='zeer_warm',updated_at=clock_timestamp()
    WHERE id=v_c;
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(
      v_object,'b4000000-0000-4000-8000-000000000022',
      'b4000000-0000-4000-8000-000000000023');
  EXCEPTION WHEN serialization_failure THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Verouderd herstel werd toegestaan'; END IF;
  IF (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_a)<>'warm'
      OR (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_c)<>'zeer_warm' THEN
    RAISE EXCEPTION 'Herstel met conflict heeft gedeeltelijk geschreven';
  END IF;
  IF EXISTS(SELECT 1 FROM public.crm_pipeline_bulk_herstel_requests
    WHERE id='b4000000-0000-4000-8000-000000000023') THEN
    RAISE EXCEPTION 'Mislukt herstel heeft request of audit achtergelaten';
  END IF;

  -- 5: Handmatige auditfout ná pipeline-update geeft volledige rollback.
  -- Bron .002 veranderde eerder B van warm naar zeer_warm.
  SELECT updated_at INTO v_b_version FROM public.object_pipeline WHERE id=v_b;
  PERFORM set_config('crm_test.fail_herstel','on',true);
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(
      v_object,'b4000000-0000-4000-8000-000000000002',
      'b4000000-0000-4000-8000-000000000030');
  EXCEPTION WHEN check_violation THEN v_error:=true; END;
  PERFORM set_config('crm_test.fail_herstel','off',true);
  IF NOT v_error THEN RAISE EXCEPTION 'Geforceerde auditfout is niet opgetreden'; END IF;
  IF (SELECT updated_at FROM public.object_pipeline WHERE id=v_b)<>v_b_version
     OR (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_b)<>'zeer_warm' THEN
    RAISE EXCEPTION 'Auditfout heeft gegevens gedeeltelijk hersteld';
  END IF;
  IF EXISTS(SELECT 1 FROM public.crm_pipeline_bulk_herstel_requests
    WHERE id='b4000000-0000-4000-8000-000000000030') THEN
    RAISE EXCEPTION 'Auditfout liet herstelverzoek achter';
  END IF;
  -- Exact hetzelfde herstel-ID mag na teruggedraaide fout alsnog slagen.
  v_result:=public.crm_pipeline_bulk_herstellen(
      v_object,'b4000000-0000-4000-8000-000000000002',
      'b4000000-0000-4000-8000-000000000030');
  IF v_result->>'hersteld'<>'1'
     OR (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_b)<>'warm' THEN
    RAISE EXCEPTION 'Na mislukte hersteltransactie kon B niet worden teruggezet';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit
       WHERE request_id='b4000000-0000-4000-8000-000000000002')<>1 THEN
    RAISE EXCEPTION 'Originele B audit ontbreekt na herstellen';
  END IF;

  -- 6: Niet de echte document-/reactiegeschiedenis verwijderen.
  IF (SELECT count(*) FROM public.crm_bulk_test_contact_moments)<>0 THEN
    RAISE EXCEPTION 'Herstel mocht geen kopersreacties aanmaken';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_herstel_audit)<>3 THEN
    RAISE EXCEPTION 'Verwacht 3 afzonderlijke herstel-auditregels';
  END IF;

  -- 7: Historie en succesresultaat zijn voor gewone clients read-only.
  v_error:=false;
  BEGIN
    UPDATE public.crm_pipeline_bulk_herstel_audit
       SET voor='{}'::jsonb WHERE bron_request_id=v_bron;
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Client kon herstelhistorie vervalsen'; END IF;
  v_error:=false;
  BEGIN
    DELETE FROM public.crm_pipeline_bulk_herstel_audit WHERE bron_request_id=v_bron;
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Client kon herstelhistorie verwijderen'; END IF;
  v_error:=false;
  BEGIN
    INSERT INTO public.crm_pipeline_bulk_herstel_requests(
      id,bron_request_id,object_id,actor_id,payload_hash
    ) VALUES (
      'b4000000-0000-4000-8000-000000000040',
      'b4000000-0000-4000-8000-000000000022',
      v_object,'11111111-1111-1111-1111-111111111111',repeat('a',32)
    );
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Client kon zelf een herstelverzoek toevoegen'; END IF;
END
$verify_herstel$;
RESET ROLE;

-- Een andere ingelogde identiteit, ook in hetzelfde project, wordt geweigerd.
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $deny$
DECLARE v_error boolean:=false; v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.crm_pipeline_bulk_herstel_audit;
  IF v_count<>0 THEN RAISE EXCEPTION 'Niet-intern ziet herstelhistorie'; END IF;
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(
      'b1000000-0000-4000-8000-000000000001',
      'b4000000-0000-4000-8000-000000000022',
      'b4000000-0000-4000-8000-000000000041'
    );
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Niet-interne gebruiker kon herstellen'; END IF;
END $deny$;
RESET ROLE;

-- De publieke, niet-ingelogde rol heeft geen recht op de functie.
SET ROLE anon;
DO $anon$
DECLARE v_error boolean:=false;
BEGIN
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(
      'b1000000-0000-4000-8000-000000000001',
      'b4000000-0000-4000-8000-000000000022',
      'b4000000-0000-4000-8000-000000000042'
    );
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Anon kon herstel aanroepen'; END IF;
END $anon$;
RESET ROLE;

SELECT 'CRM bulkherstel: auditbehoud, idempotentie, conflict, rollback en rechten geslaagd' AS resultaat;
