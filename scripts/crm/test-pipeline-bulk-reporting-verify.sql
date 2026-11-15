-- Separate CI-only test, after the real-schema trigger test.
-- View counts ONLY active internal bulk exclusions; never invent buyer replies.
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $report$
DECLARE
  v_object uuid:='b1000000-0000-4000-8000-000000000001';
  v_candidate uuid:='b2000000-0000-4000-8000-000000000002';
  v_original uuid:='b4000000-0000-4000-8000-000000000061';
  v_request uuid:='b4000000-0000-4000-8000-000000000064';
  v_restore uuid:='b4000000-0000-4000-8000-000000000065';
  v_version timestamptz;
  v_response jsonb;
  v_count integer;
BEGIN
  -- Earlier source .061 has been restored; it must NOT appear as active.
  SELECT count(*) INTO v_count
  FROM public.crm_pipeline_bulk_actuele_interne_afwijzingen
  WHERE object_id=v_object;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'Herstelde uitsluiting telt alsnog als actueel';
  END IF;
  SELECT updated_at INTO v_version FROM public.object_pipeline
  WHERE id=v_candidate;
  v_response:=public.crm_pipeline_bulk_opslaan(v_object,v_request,
    jsonb_build_array(jsonb_build_object(
      'id',v_candidate,'expected_updated_at',v_version
    )),'{"type":"afwijzen","bron":"intern","categorie":"locatie"}'::jsonb);
  IF v_response->>'aangepast'<>'1' THEN
    RAISE EXCEPTION 'Nieuwe interne uitsluiting is niet vastgelegd';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.crm_pipeline_bulk_actuele_interne_afwijzingen
  WHERE kandidaat_id=v_candidate AND categorie='locatie';
  IF v_count<>1 THEN
    RAISE EXCEPTION 'Canonieke categorie locatie ontbreekt in view';
  END IF;
  SELECT aantal INTO v_count
  FROM public.crm_pipeline_bulk_interne_afwijzingen_per_categorie
  WHERE object_id=v_object AND categorie='locatie';
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Aggregatie per categorie onjuist';
  END IF;

  -- Een herstel mag geen actieve telling achterlaten.
  v_response:=public.crm_pipeline_bulk_herstellen(v_object,v_request,v_restore);
  IF v_response->>'hersteld'<>'1' THEN
    RAISE EXCEPTION 'Herstel van rapportagetoestand niet bevestigd';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.crm_pipeline_bulk_interne_afwijzingen_per_categorie
  WHERE object_id=v_object;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'Herstelde afwijzing blijft zichtbaar in actieve rapportage';
  END IF;

  -- De (niet-muteerbare) bron-audit blijft gewoon aanwezig.
  IF (SELECT count(*) FROM public.crm_pipeline_bulk_audit
      WHERE request_id=v_request)<>1
      OR (SELECT count(*) FROM public.crm_pipeline_bulk_herstel_audit
          WHERE bron_request_id=v_request)<>1 THEN
    RAISE EXCEPTION 'Rapportage mag de oorspronkelijke audit niet verwijderen';
  END IF;
END $report$;
RESET ROLE;

-- Alleen interne medewerkers mogen view-data zien. security_invoker=true
-- gebruikt de onderliggende kandidaat- en audit-RLS van de caller.
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $unauthorized$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count
 FROM public.crm_pipeline_bulk_actuele_interne_afwijzingen;
 IF v_count<>0 THEN RAISE EXCEPTION 'Niet-interne gebruiker ziet audits'; END IF;
END $unauthorized$;
RESET ROLE;

SET ROLE anon;
DO $anon$
DECLARE v_failed boolean:=false;
BEGIN
 BEGIN
   PERFORM count(*) FROM public.crm_pipeline_bulk_interne_afwijzingen_per_categorie;
 EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
 IF NOT v_failed THEN RAISE EXCEPTION 'Anonieme gebruiker kan rapportage lezen'; END IF;
END $anon$;
RESET ROLE;

DO $security$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname='crm_pipeline_bulk_actuele_interne_afwijzingen'
    AND 'security_invoker=true'=ANY(c.reloptions)
 ) THEN RAISE EXCEPTION 'Rapportage is geen RLS security_invoker view'; END IF;
END $security$;
SELECT 'CRM afwijsrapportage: canonieke categorie, herstel en invoker-RLS geslaagd' AS resultaat;
