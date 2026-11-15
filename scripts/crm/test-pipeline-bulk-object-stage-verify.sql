-- Alleen CI, na de bestaande bulk- en hersteltests. Nul echte CRM-records.
-- Controleer pariteit met single-candidate objectpipeline-automatisering.
CREATE FUNCTION public.crm_bulk_test_reject_object_stage() RETURNS trigger
LANGUAGE plpgsql AS $trigger$
BEGIN
  IF current_setting('crm_test.fail_object_stage',true)='on'
     AND NEW.pipeline_stage_id='b6000000-0000-4000-8000-000000000120'::uuid THEN
    RAISE EXCEPTION 'Geforceerde objectpipelinefout' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$trigger$;
CREATE TRIGGER crm_bulk_test_fail_object_stage
  BEFORE UPDATE ON public.objecten
  FOR EACH ROW EXECUTE FUNCTION public.crm_bulk_test_reject_object_stage();

SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $verify_object_pipeline$
DECLARE
  v_object uuid := 'b1000000-0000-4000-8000-000000000001';
  v_a uuid := 'b2000000-0000-4000-8000-000000000001';
  v_b uuid := 'b2000000-0000-4000-8000-000000000002';
  v_c uuid := 'b2000000-0000-4000-8000-000000000003';
  v_pipeline uuid := 'b5000000-0000-4000-8000-000000000001';
  v_stage_40 uuid := 'b6000000-0000-4000-8000-000000000040';
  v_stage_80 uuid := 'b6000000-0000-4000-8000-000000000080';
  v_stage_120 uuid := 'b6000000-0000-4000-8000-000000000120';
  v_stage_130 uuid := 'b6000000-0000-4000-8000-000000000130';
  v_stage_140 uuid := 'b6000000-0000-4000-8000-000000000140';
  v_req uuid := 'b4000000-0000-4000-8000-000000000050';
  v_a_time timestamptz;
  v_b_time timestamptz;
  v_c_time timestamptz;
  v_object_time timestamptz;
  v_result jsonb;
  v_error boolean;
BEGIN
  UPDATE public.objecten
    SET pipeline_id=v_pipeline,pipeline_stage_id=v_stage_40,
        pipeline_stage_locked=false,pipeline_updated_at=clock_timestamp()
    WHERE id=v_object;

  -- 1. Eén bulkfase voor twee kandidaten brengt ook het OBJECT vooruit.
  SELECT updated_at INTO v_a_time FROM public.object_pipeline WHERE id=v_a;
  SELECT updated_at INTO v_c_time FROM public.object_pipeline WHERE id=v_c;
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,v_req,
    jsonb_build_array(
      jsonb_build_object('id',v_a,'expected_updated_at',v_a_time),
      jsonb_build_object('id',v_c,'expected_updated_at',v_c_time)
    ),'{"type":"fase","fase":"indicatieve_bieding"}'::jsonb);
  IF v_result->>'aangepast'<>'2'
     OR v_result->'object_fase_wijziging'->>'nieuwe_slug'<>'biedingen_ontvangen'
     OR v_result->'object_fase_wijziging'->>'oude_stage_id'<>v_stage_40::text
     OR v_result->'object_fase_wijziging'->>'nieuwe_stage_id'<>v_stage_80::text THEN
    RAISE EXCEPTION 'Bulk heeft kandidaat/object stage niet synchroon vooruitgezet: %',v_result;
  END IF;
  IF (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_80 THEN
    RAISE EXCEPTION 'Objectpipeline bleef achter bij bulkfase';
  END IF;

  -- 2. Idempotente retry: nooit opnieuw het Object vooruitzetten.
  SELECT pipeline_updated_at INTO v_object_time FROM public.objecten WHERE id=v_object;
  IF public.crm_pipeline_bulk_opslaan(v_object,v_req,
    jsonb_build_array(
      jsonb_build_object('id',v_a,'expected_updated_at',v_a_time),
      jsonb_build_object('id',v_c,'expected_updated_at',v_c_time)
    ),'{"type":"fase","fase":"indicatieve_bieding"}'::jsonb)<>v_result THEN
    RAISE EXCEPTION 'Retry gaf ander resultaat bij automatische objectfase';
  END IF;
  IF (SELECT pipeline_updated_at FROM public.objecten WHERE id=v_object)<>v_object_time THEN
    RAISE EXCEPTION 'Idempotente retry heeft de objectfase opnieuw gewijzigd';
  END IF;

  -- 3. In een handmatig vergrendeld object mag kandidaat wel, Object niet schuiven.
  UPDATE public.objecten SET pipeline_stage_id=v_stage_40,pipeline_stage_locked=true
    WHERE id=v_object;
  SELECT updated_at INTO v_b_time FROM public.object_pipeline WHERE id=v_b;
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,
    'b4000000-0000-4000-8000-000000000051',
    jsonb_build_array(jsonb_build_object('id',v_b,'expected_updated_at',v_b_time)),
    '{"type":"fase","fase":"loi_ontvangen"}'::jsonb);
  IF v_result->>'aangepast'<>'1'
     OR v_result->'object_fase_wijziging' IS DISTINCT FROM 'null'::jsonb
     OR (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_40 THEN
    RAISE EXCEPTION 'Vergrendelde objectfase werd toch aangepast';
  END IF;

  -- 4. Een terminale Objectfase blijft terminal, zelfs zonder handmatig slot.
  UPDATE public.objecten SET pipeline_stage_id=v_stage_140,
    pipeline_stage_locked=false WHERE id=v_object;
  SELECT updated_at INTO v_b_time FROM public.object_pipeline WHERE id=v_b;
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,
    'b4000000-0000-4000-8000-000000000052',
    jsonb_build_array(jsonb_build_object('id',v_b,'expected_updated_at',v_b_time)),
    '{"type":"fase","fase":"due_diligence"}'::jsonb);
  IF v_result->>'aangepast'<>'1'
     OR (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_140
     OR v_result->'object_fase_wijziging' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Terminale objectfase werd overschreven';
  END IF;

  -- 5. Bestaande latere Objectfase mag nooit worden teruggezet.
  UPDATE public.objecten SET pipeline_stage_id=v_stage_130 WHERE id=v_object;
  SELECT updated_at INTO v_c_time FROM public.object_pipeline WHERE id=v_c;
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,
    'b4000000-0000-4000-8000-000000000053',
    jsonb_build_array(jsonb_build_object('id',v_c,'expected_updated_at',v_c_time)),
    '{"type":"fase","fase":"nda_getekend"}'::jsonb);
  IF v_result->>'aangepast'<>'1'
     OR (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_130
     OR v_result->'object_fase_wijziging' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Bulk heeft een Object teruggezet';
  END IF;

  -- 6. Intern afwijzen mag de Objectfase niet aanpassen.
  SELECT updated_at INTO v_c_time FROM public.object_pipeline WHERE id=v_c;
  v_result:=public.crm_pipeline_bulk_opslaan(v_object,
    'b4000000-0000-4000-8000-000000000054',
    jsonb_build_array(jsonb_build_object('id',v_c,'expected_updated_at',v_c_time)),
    '{"type":"afwijzen","bron":"intern","categorie":"locatie"}'::jsonb);
  IF v_result->'object_fase_wijziging' IS DISTINCT FROM 'null'::jsonb
     OR (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_130 THEN
    RAISE EXCEPTION 'Interne uitsluiting heeft objectfase gewijzigd';
  END IF;

  -- 7. Geforceerde fout bij het Object na kandidaat-update: alles rollback.
  UPDATE public.objecten SET pipeline_stage_id=v_stage_40,pipeline_stage_locked=false
    WHERE id=v_object;
  SELECT updated_at INTO v_b_time FROM public.object_pipeline WHERE id=v_b;
  PERFORM set_config('crm_test.fail_object_stage','on',true);
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_opslaan(v_object,
      'b4000000-0000-4000-8000-000000000055',
      jsonb_build_array(jsonb_build_object('id',v_b,'expected_updated_at',v_b_time)),
      '{"type":"fase","fase":"koopovereenkomst_concept"}'::jsonb);
  EXCEPTION WHEN check_violation THEN v_error:=true; END;
  PERFORM set_config('crm_test.fail_object_stage','off',true);
  IF NOT v_error THEN RAISE EXCEPTION 'Objectfout is niet gesignaleerd'; END IF;
  IF (SELECT pipeline_fase FROM public.object_pipeline WHERE id=v_b)<>'due_diligence'
     OR (SELECT updated_at FROM public.object_pipeline WHERE id=v_b)<>v_b_time
     OR (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_40 THEN
    RAISE EXCEPTION 'Objectfout heeft kandidaten deels bijgewerkt';
  END IF;
  IF EXISTS(SELECT 1 FROM public.crm_pipeline_bulk_requests WHERE
    id='b4000000-0000-4000-8000-000000000055') OR EXISTS(
    SELECT 1 FROM public.crm_pipeline_bulk_audit WHERE
      request_id='b4000000-0000-4000-8000-000000000055'
    ) THEN RAISE EXCEPTION 'Objectfout heeft audit of verzoek achtergelaten'; END IF;

  -- 8. Een herstelactie draait kandidaat terug; Objectfase blijft vooruit.
  -- Sinds bron .050 is C opnieuw aangepast; een herstel moet weigeren.
  -- Ook dan mag het Object niet terugvallen en blijft bron-audit beschikbaar.
  v_error:=false;
  BEGIN
    PERFORM public.crm_pipeline_bulk_herstellen(v_object,v_req,
      'b4000000-0000-4000-8000-000000000056');
  EXCEPTION WHEN serialization_failure THEN v_error:=true; END;
  IF NOT v_error
     OR (SELECT pipeline_stage_id FROM public.objecten WHERE id=v_object)<>v_stage_40 THEN
    RAISE EXCEPTION 'Verouderd herstel van bulkfase werd verkeerd uitgevoerd';
  END IF;
END
$verify_object_pipeline$;
RESET ROLE;
