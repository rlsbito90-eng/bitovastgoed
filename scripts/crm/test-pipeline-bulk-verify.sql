-- Volledig synthetische records, uitsluitend in een tijdelijke GitHub Actions database.
INSERT INTO public.objecten(id,objectnaam,type_vastgoed) VALUES
 ('b1000000-0000-4000-8000-000000000001','Fictief object A','wonen'),
 ('b1000000-0000-4000-8000-000000000002','Fictief object B','bedrijf');
INSERT INTO public.object_pipeline(
  id,object_id,relatie_id,pipeline_fase,interesse_niveau,updated_at
) VALUES
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001','match_gevonden','lauw','2026-11-15 08:00+00'),
 ('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000002','informatie_gedeeld','warm','2026-11-15 08:00+00'),
 ('b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003','bezichtiging_gepland','lauw','2026-11-15 08:00+00'),
 ('b2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000004','afgevallen','koud','2026-11-15 08:00+00'),
 ('b2000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000005','match_gevonden','lauw','2026-11-15 08:00+00');

-- Trigger faalt op de tweede kandidaat na een eerdere geldige wijziging.
CREATE FUNCTION public.crm_bulk_test_reject_audit() RETURNS trigger
LANGUAGE plpgsql AS $trigger$
BEGIN
  IF current_setting('crm_test.fail_audit',true)='on'
     AND NEW.kandidaat_id='b2000000-0000-4000-8000-000000000003'::uuid THEN
    RAISE EXCEPTION 'Geforceerde auditfout voor atomaire rollback' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$trigger$;
CREATE TRIGGER crm_bulk_test_fail_audit
  BEFORE INSERT ON public.crm_pipeline_bulk_audit
  FOR EACH ROW EXECUTE FUNCTION public.crm_bulk_test_reject_audit();

SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;

DO $verify$
DECLARE
  v_object uuid := 'b1000000-0000-4000-8000-000000000001';
  v_other uuid := 'b1000000-0000-4000-8000-000000000002';
  v_a uuid := 'b2000000-0000-4000-8000-000000000001';
  v_b uuid := 'b2000000-0000-4000-8000-000000000002';
  v_c uuid := 'b2000000-0000-4000-8000-000000000003';
  v_d uuid := 'b2000000-0000-4000-8000-000000000004';
  v_e uuid := 'b2000000-0000-4000-8000-000000000005';
  v_req1 uuid := 'b4000000-0000-4000-8000-000000000001';
  v_req2 uuid := 'b4000000-0000-4000-8000-000000000002';
  v_items jsonb;
  v_result jsonb;
  v_a_old timestamptz;
  v_a_new timestamptz;
  v_b_old timestamptz;
  v_c_old timestamptz;
  v_e_old timestamptz;
  v_a_interest public.interesse_niveau;
  v_error boolean;
  v_count integer;
BEGIN
  SELECT updated_at INTO v_a_old FROM public.object_pipeline WHERE id=v_a;
  SELECT updated_at INTO v_b_old FROM public.object_pipeline WHERE id=v_b;
  SELECT updated_at INTO v_c_old FROM public.object_pipeline WHERE id=v_c;
  SELECT updated_at INTO v_e_old FROM public.object_pipeline WHERE id=v_e;

  -- 1. Succes: twee geselecteerd, slechts één werkelijk gewijzigd.
  v_items:=jsonb_build_array(
    jsonb_build_object('id',v_a,'expected_updated_at',v_a_old),
    jsonb_build_object('id',v_b,'expected_updated_at',v_b_old));
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,v_req1,v_items,
    '{"type":"fase","fase":"informatie_gedeeld"}'::jsonb);
  IF v_result->>'aangepast'<>'1' OR v_result->>'ongewijzigd'<>'1' THEN
    RAISE EXCEPTION 'Niet correct geteld: %',v_result;
  END IF;
  IF jsonb_array_length(v_result->'wijzigingen')<>1 THEN
    RAISE EXCEPTION 'Bulkresultaat moet één werkelijk gewijzigde rij bevatten';
  END IF;
  SELECT updated_at INTO v_a_new FROM public.object_pipeline WHERE id=v_a;
  IF v_a_new<=v_a_old THEN RAISE EXCEPTION 'Versie a niet verhoogd'; END IF;
  IF (SELECT updated_at FROM public.object_pipeline WHERE id=v_b)<>v_b_old THEN
    RAISE EXCEPTION 'Onveranderde kandidaat heeft gewijzigde timestamp';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit WHERE request_id=v_req1)<>1 THEN
    RAISE EXCEPTION 'Auditregel ontbreekt of is dubbel';
  END IF;

  -- 2. Retry met hetzelfde ID én exact dezelfde payload: cached response.
  IF public.crm_pipeline_bulk_opslaan(v_object,v_req1,v_items,
    '{"type":"fase","fase":"informatie_gedeeld"}'::jsonb)<>v_result THEN
    RAISE EXCEPTION 'Idempotente herhaling gaf een ander resultaat';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit WHERE request_id=v_req1)<>1 THEN
    RAISE EXCEPTION 'Retry heeft duplicaat auditregels aangemaakt';
  END IF;
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,v_req1,v_items,
      '{"type":"interesse","niveau":"warm"}'::jsonb);
  EXCEPTION WHEN unique_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Hergebruikt verzoek-ID met andere payload geaccepteerd'; END IF;

  -- 3. Tweede geldige bewerking van B; vervolgens stale B in een nieuwe batch.
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,v_req2,
    jsonb_build_array(jsonb_build_object('id',v_b,'expected_updated_at',v_b_old)),
    '{"type":"interesse","niveau":"zeer_warm"}'::jsonb);
  IF v_result->>'aangepast'<>'1' THEN RAISE EXCEPTION 'Kandidaat B niet bijgewerkt'; END IF;
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000003'::uuid,
      jsonb_build_array(
        jsonb_build_object('id',v_a,'expected_updated_at',v_a_new),
        jsonb_build_object('id',v_b,'expected_updated_at',v_b_old)),
      '{"type":"interesse","niveau":"koud"}'::jsonb);
  EXCEPTION WHEN serialization_failure THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Verouderde B heeft toch A overschreven'; END IF;
  IF (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_a)<>'lauw' THEN
    RAISE EXCEPTION 'A deels gewijzigd na versieconflict';
  END IF;
  IF EXISTS (SELECT 1 FROM public.crm_pipeline_bulk_requests
    WHERE id='b4000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Mislukt batchverzoek is vastgelegd';
  END IF;

  -- 4. Cross-object/duplicate/status/payload-afwijzingen zijn atomair.
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000004'::uuid,
      jsonb_build_array(
        jsonb_build_object('id',v_a,'expected_updated_at',v_a_new),
        jsonb_build_object('id',v_e,'expected_updated_at',v_e_old)),
      '{"type":"interesse","niveau":"zeer_warm"}'::jsonb);
  EXCEPTION WHEN foreign_key_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Kandidaat uit ander object toegelaten'; END IF;
  IF (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_a)<>'lauw' THEN
    RAISE EXCEPTION 'Cross-object bewerking is deels verwerkt';
  END IF;

  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000005'::uuid,
      jsonb_build_array(
        jsonb_build_object('id',v_a,'expected_updated_at',v_a_new),
        jsonb_build_object('id',v_a,'expected_updated_at',v_a_new)),
      '{"type":"interesse","niveau":"warm"}'::jsonb);
  EXCEPTION WHEN unique_violation THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Dubbele kandidaat-ID niet geweigerd'; END IF;

  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000006'::uuid,
      jsonb_build_array(
        jsonb_build_object('id',v_a,'expected_updated_at',v_a_new),
        jsonb_build_object('id',v_d,'expected_updated_at',v_a_old)),
      '{"type":"interesse","niveau":"warm"}'::jsonb);
  EXCEPTION WHEN check_violation OR serialization_failure THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Afgevallen kandidaat niet beschermd'; END IF;
  IF (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_a)<>'lauw' THEN
    RAISE EXCEPTION 'Afgevallen kandidaat liet gedeeltelijke write toe';
  END IF;

  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000007'::uuid,
      jsonb_build_array(jsonb_build_object('id',v_a,'expected_updated_at',v_a_new)),
      '{"type":"afwijzen","bron":"koper","categorie":"prijs"}'::jsonb);
  EXCEPTION WHEN invalid_parameter_value THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Ontvangen kopersreactie in bulk aangemaakt'; END IF;

  -- 5. Fout tijdens audit van C na mutatie van A: beide rollback.
  PERFORM set_config('crm_test.fail_audit','on',true);
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000008'::uuid,
      jsonb_build_array(
        jsonb_build_object('id',v_a,'expected_updated_at',v_a_new),
        jsonb_build_object('id',v_c,'expected_updated_at',v_c_old)),
      '{"type":"interesse","niveau":"warm"}'::jsonb);
  EXCEPTION WHEN check_violation THEN v_error:=true; END;
  PERFORM set_config('crm_test.fail_audit','off',true);
  IF NOT v_error THEN RAISE EXCEPTION 'Geforceerde fout op C had batch moeten terugrollen'; END IF;
  IF (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_a)<>'lauw'
      OR (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_c)<>'lauw' THEN
    RAISE EXCEPTION 'Geen volledige rollback bij auditfout';
  END IF;
  IF EXISTS(SELECT 1 FROM public.crm_pipeline_bulk_requests
       WHERE id='b4000000-0000-4000-8000-000000000008') THEN
    RAISE EXCEPTION 'Mislukt verzoek/audit niet teruggerold';
  END IF;

  -- 6. Interne uitsluiting: auditbron is intern, kopersfeedback blijft leeg.
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,
    'b4000000-0000-4000-8000-000000000009'::uuid,
    jsonb_build_array(
      jsonb_build_object('id',v_a,'expected_updated_at',v_a_new),
      jsonb_build_object('id',v_c,'expected_updated_at',v_c_old)),
    '{"type":"afwijzen","bron":"intern","categorie":"locatie"}'::jsonb);
  IF v_result->>'aangepast'<>'2' THEN
    RAISE EXCEPTION 'Twee interne uitsluitingen niet correct opgeslagen';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit
      WHERE request_id='b4000000-0000-4000-8000-000000000009'::uuid
        AND bron='intern' AND reden_code='locatie')<>2 THEN
    RAISE EXCEPTION 'Afwijzingscategorie niet apart in het auditspoor';
  END IF;
  IF (SELECT count(*) FROM public.crm_bulk_test_contact_moments)<>0 THEN
    RAISE EXCEPTION 'Fictieve kopersreacties werden aangemaakt';
  END IF;
  IF (SELECT count(*) FROM public.object_pipeline
      WHERE id=ANY(ARRAY[v_a,v_c]) AND pipeline_fase='afgevallen')<>2 THEN
    RAISE EXCEPTION 'Afgevallen-status niet vastgelegd';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit)<>4 THEN
    RAISE EXCEPTION 'Verwacht 4 auditregels: 1 fase, 1 interesse, 2 intern';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_requests)<>3 THEN
    RAISE EXCEPTION 'Mislukte/verouderde requests niet goed teruggerold';
  END IF;

  -- 7. Audit moet voor reguliere gebruikers append-only zijn.
  v_error:=false;
  BEGIN
    UPDATE public.crm_pipeline_bulk_audit SET reden_code='prijs'
      WHERE kandidaat_id=v_a;
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Audit kon achteraf worden gewijzigd'; END IF;
END $verify$;

-- Directe bewerking van request-identiteit of het vervalsen van een cached
-- resultaat bij INSERT mag niet kunnen, ook niet als ingelogde interne gebruiker.
DO $request_integrity$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.crm_pipeline_bulk_requests(id,object_id,actor_id,payload_hash,result)
    VALUES(
      'b4000000-0000-4000-8000-000000000010',
      'b1000000-0000-4000-8000-000000000001',
      '11111111-1111-1111-1111-111111111111',
      repeat('0',32), '{"aangepast":100}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Vervalste cached response in INSERT geaccepteerd'; END IF;

  v_denied:=false;
  BEGIN
    UPDATE public.crm_pipeline_bulk_requests SET payload_hash=repeat('1',32)
    WHERE id='b4000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Client kon payload hash na afloop wijzigen'; END IF;

  v_denied:=false;
  BEGIN
    UPDATE public.crm_pipeline_bulk_requests
       SET result='{"aangepast":999,"ongewijzigd":0,"wijzigingen":[]}'::jsonb
     WHERE id='b4000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Client kon bestaand opgeslagen resultaat vervalsen'; END IF;

  v_denied:=false;
  BEGIN
    INSERT INTO public.crm_pipeline_bulk_audit(
      request_id,object_id,kandidaat_id,actor_id,actie,voor,na
    ) VALUES (
      'b4000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      '11111111-1111-1111-1111-111111111111',
      'fase','{}'::jsonb,'{}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Client kon auditregel zelf schrijven'; END IF;
END $request_integrity$;
RESET ROLE;

-- Niet-interne ingelogde persoon: noch lezen noch functie uitvoeren.
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $deny$
DECLARE v_error boolean:=false; v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.crm_pipeline_bulk_audit;
  IF v_count<>0 THEN RAISE EXCEPTION 'Niet-interne gebruiker kan audit lezen'; END IF;
  SELECT count(*) INTO v_count FROM public.crm_pipeline_bulk_requests;
  IF v_count<>0 THEN RAISE EXCEPTION 'Niet-interne gebruiker kan verzoeken lezen'; END IF;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(
      'b1000000-0000-4000-8000-000000000001',
      'b4000000-0000-4000-8000-000000000099',
      '[{"id":"b2000000-0000-4000-8000-000000000001","expected_updated_at":"2026-11-15T08:00:00Z"}]'::jsonb,
      '{"type":"interesse","niveau":"warm"}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Niet-interne gebruiker kon bulk uitvoeren'; END IF;
END $deny$;
RESET ROLE;

-- Anonieme rol heeft geen EXECUTE of datarechten.
SET ROLE anon;
DO $anon$
DECLARE v_error boolean:=false;
BEGIN
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(
      'b1000000-0000-4000-8000-000000000001',
      'b4000000-0000-4000-8000-000000000098',
      '[]'::jsonb,'{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
  IF NOT v_error THEN RAISE EXCEPTION 'Anon heeft EXECUTE rechten'; END IF;
END $anon$;
RESET ROLE;

SELECT 'CRM bulkopslag: transactie, audit, idempotentie, versieconflict en rechten geslaagd' AS resultaat;
