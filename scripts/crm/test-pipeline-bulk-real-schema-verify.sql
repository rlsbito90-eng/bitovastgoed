-- Tests met ECHTE object_pipeline-, taak-sync- en verliescode-migraties
-- in een geheel nieuwe, tijdelijke PostgreSQL-database.
-- Zolang een taakwissel niet herstelbaar is, is een productie-herstelrelease GEEN GO.
SET client_min_messages = warning;
GRANT SELECT,INSERT,UPDATE ON public.object_pipeline TO authenticated;
GRANT SELECT,UPDATE ON public.objecten TO authenticated;
GRANT SELECT ON public.taken TO authenticated;
GRANT SELECT ON public.pipelines,public.pipeline_stages TO authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);

INSERT INTO public.objecten(id,objectnaam,type_vastgoed) VALUES
('b1000000-0000-4000-8000-000000000001','Fictief testobject','wonen');

-- Directe inserts in een afzonderlijke autocommit-transactie, zodat de echte
-- updated_at-trigger bij latere RPC-acties een andere transactietijd kan zetten.
INSERT INTO public.object_pipeline(
  id,object_id,relatie_id,pipeline_fase,interesse_niveau,
  volgende_actie,volgende_actie_datum,volgende_actie_omschrijving
) VALUES
('b2000000-0000-4000-8000-000000000001',
 'b1000000-0000-4000-8000-000000000001',
 'b3000000-0000-4000-8000-000000000001',
 'informatie_gedeeld','lauw','bellen','2026-11-20','Fictieve opvolging'),
('b2000000-0000-4000-8000-000000000002',
 'b1000000-0000-4000-8000-000000000001',
 'b3000000-0000-4000-8000-000000000002',
 'match_gevonden','lauw',NULL,NULL,NULL);

SET ROLE authenticated;
DO $verify$
DECLARE
 v_object uuid:='b1000000-0000-4000-8000-000000000001';
 v_a uuid:='b2000000-0000-4000-8000-000000000001';
 v_b uuid:='b2000000-0000-4000-8000-000000000002';
 v_original_task uuid;
 v_new_task uuid;
 v_initial timestamptz;
 v_request uuid:='b4000000-0000-4000-8000-000000000061';
 v_response jsonb;
 v_restore jsonb;
 v_reason text;
 v_audit_code text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.object_pipeline'::regclass
       AND tgname='trg_object_pipeline_updated' AND tgenabled='O')
     OR NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.object_pipeline'::regclass
       AND tgname='trg_pipeline_lost_reason_code' AND tgenabled='O')
     OR NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.object_pipeline'::regclass
       AND tgname='trg_sync_pipeline_next_action_task' AND tgenabled='O')
  THEN RAISE EXCEPTION 'Niet alle drie echte CRM-pipelinetriggers zijn aanwezig'; END IF;

  SELECT updated_at INTO v_initial FROM public.object_pipeline WHERE id=v_a;
  SELECT id INTO v_original_task FROM public.taken
   WHERE source_id=v_a AND status='open';
  IF v_original_task IS NULL THEN
    RAISE EXCEPTION 'Echte vervolgtaak-trigger heeft geen taak aangemaakt';
  END IF;

  -- Eén atomische interne uitsluiting van twee kandidaten.
  v_response:=public.crm_pipeline_bulk_opslaan(
    v_object,v_request,
    jsonb_build_array(
       jsonb_build_object('id',v_a,'expected_updated_at',v_initial),
       jsonb_build_object('id',v_b,'expected_updated_at',
          (SELECT updated_at FROM public.object_pipeline WHERE id=v_b))
    ),'{"type":"afwijzen","bron":"intern","categorie":"locatie"}'::jsonb
  );
  IF v_response->>'aangepast'<>'2' THEN
    RAISE EXCEPTION 'Niet alle kandidaten zijn uitgesloten: %',v_response;
  END IF;
  IF (SELECT status FROM public.taken WHERE id=v_original_task)<>'geannuleerd' THEN
    RAISE EXCEPTION 'Interne uitsluiting heeft bestaande vervolgtaak niet geannuleerd';
  END IF;
  IF (SELECT count(*) FROM public.taken WHERE source_id=v_a AND status='open')<>0 THEN
    RAISE EXCEPTION 'Afgevallen kandidaat mag geen actieve vervolgtaken houden';
  END IF;
  IF (SELECT updated_at FROM public.object_pipeline WHERE id=v_a)=v_initial THEN
    RAISE EXCEPTION 'De echte updated_at-trigger leverde geen nieuwe versie op';
  END IF;

  SELECT lost_reason_code INTO v_reason FROM public.object_pipeline WHERE id=v_a;
  SELECT reden_code INTO v_audit_code FROM public.crm_pipeline_bulk_audit
    WHERE request_id=v_request AND kandidaat_id=v_a;
  -- Bestaande classifier kent categorie "locatie" niet. De bulk-audit bewaart
  -- WEL de juiste categorie; dashboardnormalisatie is een afzonderlijke blocker.
  IF v_reason<>'other' OR v_audit_code<>'locatie' THEN
    RAISE EXCEPTION 'Mismatch tussen bestaand verliescode-model en audit onverwacht: % / %',
      v_reason,v_audit_code;
  END IF;

  v_restore:=public.crm_pipeline_bulk_herstellen(
    v_object,v_request,'b4000000-0000-4000-8000-000000000062'
  );
  IF v_restore->>'hersteld'<>'2' THEN
    RAISE EXCEPTION 'Niet alle kandidaten hersteld: %',v_restore;
  END IF;
  IF (SELECT interesse_niveau FROM public.object_pipeline WHERE id=v_a)<>'lauw'
     OR (SELECT pipeline_fase FROM public.object_pipeline WHERE id=v_a)<>'informatie_gedeeld'
     OR (SELECT reden_afgevallen FROM public.object_pipeline WHERE id=v_a) IS NOT NULL
     OR (SELECT lost_reason_code FROM public.object_pipeline WHERE id=v_a) IS NOT NULL THEN
    RAISE EXCEPTION 'De bestaande verliescode-trigger herstelde de kandidaat niet';
  END IF;

  SELECT id INTO v_new_task FROM public.taken
     WHERE source_id=v_a AND status='open';
  IF v_new_task IS NULL THEN
    RAISE EXCEPTION 'Vervolgtaak na herstel ontbreekt';
  END IF;
  IF v_new_task=v_original_task THEN
    RAISE EXCEPTION 'Verrassend: taak-ID is bij herstel hergebruikt';
  END IF;
  IF (SELECT status FROM public.taken WHERE id=v_original_task)<>'geannuleerd' THEN
    RAISE EXCEPTION 'Oude taak werd onterecht reactief gemaakt';
  END IF;
  IF (SELECT count(*) FROM public.taken WHERE source_id=v_a)<>2 THEN
    RAISE EXCEPTION 'Bij herstel zijn meer taakrijen dan verwacht ontstaan';
  END IF;
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit WHERE request_id=v_request)<>2
     OR (SELECT count(*) FROM public.crm_pipeline_bulk_herstel_audit
         WHERE bron_request_id=v_request)<>2 THEN
    RAISE EXCEPTION 'Oorspronkelijke audit en herstelaudit ontbreken';
  END IF;
  RAISE NOTICE 'VERIFICATIE: oude taak % geannuleerd; nieuwe taak % aangemaakt',v_original_task,v_new_task;
END $verify$;
RESET ROLE;

-- Test-RLS: tweede (niet-interne) gebruiker mag de kandidaatpipeline niet lezen.
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $deny$
DECLARE
 v_count integer;
 v_error boolean:=false;
BEGIN
 SELECT count(*) INTO v_count FROM public.object_pipeline;
 IF v_count<>0 THEN RAISE EXCEPTION 'Niet-interne testgebruiker zag kandidaten'; END IF;
 BEGIN
   PERFORM public.crm_pipeline_bulk_opslaan(
     'b1000000-0000-4000-8000-000000000001',
     'b4000000-0000-4000-8000-000000000063','[]'::jsonb,
     '{"type":"interesse","niveau":"warm"}'::jsonb
   );
 EXCEPTION WHEN insufficient_privilege THEN v_error:=true; END;
 IF NOT v_error THEN RAISE EXCEPTION 'Niet-interne gebruiker kon RPC aanspreken'; END IF;
END $deny$;
RESET ROLE;
SELECT 'CRM echte schematrigger-test: opvolgtaken, verliescodes, herstel en RLS geslaagd' AS resultaat;
