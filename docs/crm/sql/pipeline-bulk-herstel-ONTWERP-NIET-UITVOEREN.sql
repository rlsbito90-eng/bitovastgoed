-- BITO CRM | PROEFONTWERP, NIET UITVOEREN OP PRODUCTIE.
-- Geïsoleerde PostgreSQL CI: herstel van een HELE eerder bevestigde bulkactie.
-- Herstel is een NIEUWE transactie, geen DELETE van historie of audit.
-- Bronregels blijven bestaan. Versieconflicten stoppen de HELE herstelactie.
-- Alleen de oorspronkelijke interne medewerker kan zijn/haar bulkactie herstellen.
-- Voor inzet op Supabase eerst security review, kosten- en databankisolatie.

CREATE TABLE IF NOT EXISTS public.crm_pipeline_bulk_herstel_requests (
  id uuid PRIMARY KEY,
  bron_request_id uuid NOT NULL UNIQUE REFERENCES public.crm_pipeline_bulk_requests(id),
  object_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (length(payload_hash)=32),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.crm_pipeline_bulk_herstel_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_pipeline_bulk_herstel_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crm_pipeline_bulk_herstel_requests TO authenticated;
CREATE POLICY crm_pipeline_bulk_herstel_requests_read
  ON public.crm_pipeline_bulk_herstel_requests
  FOR SELECT TO authenticated USING (
    public.is_intern_gebruiker((SELECT auth.uid()))
    AND actor_id=(SELECT auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.crm_pipeline_bulk_herstel_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  herstel_request_id uuid NOT NULL REFERENCES public.crm_pipeline_bulk_herstel_requests(id),
  bron_request_id uuid NOT NULL REFERENCES public.crm_pipeline_bulk_requests(id),
  bron_audit_id uuid NOT NULL UNIQUE REFERENCES public.crm_pipeline_bulk_audit(id),
  object_id uuid NOT NULL,
  kandidaat_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  voor jsonb NOT NULL,
  na jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (herstel_request_id,kandidaat_id)
);
CREATE INDEX IF NOT EXISTS crm_pipeline_bulk_herstel_audit_kandidaat_idx
  ON public.crm_pipeline_bulk_herstel_audit(kandidaat_id,created_at);
ALTER TABLE public.crm_pipeline_bulk_herstel_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_pipeline_bulk_herstel_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crm_pipeline_bulk_herstel_audit TO authenticated;
CREATE POLICY crm_pipeline_bulk_herstel_audit_read
  ON public.crm_pipeline_bulk_herstel_audit
  FOR SELECT TO authenticated USING (
    public.is_intern_gebruiker((SELECT auth.uid()))
    AND actor_id=(SELECT auth.uid())
  );

CREATE OR REPLACE FUNCTION public.crm_pipeline_bulk_herstellen(
  p_object_id uuid,
  p_bron_request_id uuid,
  p_herstel_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_bron public.crm_pipeline_bulk_requests%ROWTYPE;
  v_request public.crm_pipeline_bulk_herstel_requests%ROWTYPE;
  v_audit public.crm_pipeline_bulk_audit%ROWTYPE;
  v_kandidaat public.object_pipeline%ROWTYPE;
  v_hash text;
  v_herstel_tijd timestamptz;
  v_hersteld integer := 0;
  v_result jsonb;
  v_wijzigingen jsonb := '[]'::jsonb;
BEGIN
  IF v_actor IS NULL OR NOT coalesce(public.is_intern_gebruiker(v_actor),false) THEN
    RAISE EXCEPTION 'Geen toestemming voor herstel' USING ERRCODE='42501';
  END IF;
  IF p_object_id IS NULL OR p_bron_request_id IS NULL OR p_herstel_request_id IS NULL THEN
    RAISE EXCEPTION 'Object, bronverzoek en nieuw herstel-ID verplicht' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_bron FROM public.crm_pipeline_bulk_requests
    WHERE id=p_bron_request_id AND object_id=p_object_id;
  IF NOT FOUND OR v_bron.actor_id IS DISTINCT FROM v_actor OR v_bron.result IS NULL THEN
    RAISE EXCEPTION 'Oorspronkelijke bulkactie ontbreekt of is niet van jou'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_pipeline_bulk_audit
    WHERE request_id=p_bron_request_id AND object_id=p_object_id
  ) THEN
    RAISE EXCEPTION 'Bulkactie heeft geen wijziging om te herstellen'
      USING ERRCODE='22023';
  END IF;

  v_hash:=md5(jsonb_build_object(
    'object_id',p_object_id,'bron_request_id',p_bron_request_id
  )::text);

  -- Nieuw herstelverzoek heeft een eigen uniek ID, óók bij een onzekere retry.
  -- UNIQUE(bron_request_id) laat een bron maar eenmaal succesvol herstellen.
  INSERT INTO public.crm_pipeline_bulk_herstel_requests(
    id,bron_request_id,object_id,actor_id,payload_hash
  ) VALUES (
    p_herstel_request_id,p_bron_request_id,p_object_id,v_actor,v_hash
  ) ON CONFLICT DO NOTHING;
  SELECT * INTO v_request FROM public.crm_pipeline_bulk_herstel_requests
    WHERE id=p_herstel_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deze bulkactie is al hersteld met een ander verzoek'
      USING ERRCODE='23505';
  END IF;
  IF v_request.bron_request_id<>p_bron_request_id
     OR v_request.object_id<>p_object_id
     OR v_request.actor_id<>v_actor
     OR v_request.payload_hash<>v_hash THEN
    RAISE EXCEPTION 'Herstelverzoek-ID is al gebruikt voor andere gegevens'
      USING ERRCODE='23505';
  END IF;
  IF v_request.result IS NOT NULL THEN
    RETURN v_request.result;
  END IF;

  -- ID-geordende locks. Bij één ongewijzigd/verdwenen/gewijzigd record:
  -- RAISE annuleert alle eerdere UPDATEs én auditregels in deze transactie.
  FOR v_audit IN
    SELECT * FROM public.crm_pipeline_bulk_audit
     WHERE request_id=p_bron_request_id AND object_id=p_object_id
     ORDER BY kandidaat_id
  LOOP
    SELECT * INTO v_kandidaat FROM public.object_pipeline
      WHERE id=v_audit.kandidaat_id AND object_id=p_object_id
        AND soft_deleted_at IS NULL
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Een kandidaat is verwijderd of niet meer beschikbaar'
        USING ERRCODE='23503';
    END IF;

    IF v_kandidaat.updated_at IS DISTINCT FROM
         (v_audit.na->>'updated_at')::timestamptz
       OR v_kandidaat.pipeline_fase::text IS DISTINCT FROM
         (v_audit.na->>'pipeline_fase')
       OR v_kandidaat.interesse_niveau::text IS DISTINCT FROM
         (v_audit.na->>'interesse_niveau')
       OR v_kandidaat.reden_afgevallen IS DISTINCT FROM
         (v_audit.na->>'reden_afgevallen') THEN
      RAISE EXCEPTION 'Een kandidaat is na de bulkactie gewijzigd. Geen herstel uitgevoerd'
        USING ERRCODE='40001';
    END IF;

    UPDATE public.object_pipeline SET
      pipeline_fase=(v_audit.voor->>'pipeline_fase')::public.pipeline_fase,
      interesse_niveau=(v_audit.voor->>'interesse_niveau')::public.interesse_niveau,
      reden_afgevallen=v_audit.voor->>'reden_afgevallen',
      updated_at=clock_timestamp()
    WHERE id=v_kandidaat.id
    RETURNING updated_at INTO v_herstel_tijd;

    INSERT INTO public.crm_pipeline_bulk_herstel_audit(
      herstel_request_id,bron_request_id,bron_audit_id,object_id,
      kandidaat_id,actor_id,voor,na
    ) VALUES (
      p_herstel_request_id,p_bron_request_id,v_audit.id,p_object_id,
      v_kandidaat.id,v_actor,v_audit.na,
      jsonb_build_object(
        'pipeline_fase',v_audit.voor->'pipeline_fase',
        'interesse_niveau',v_audit.voor->'interesse_niveau',
        'reden_afgevallen',v_audit.voor->'reden_afgevallen',
        'updated_at',v_herstel_tijd
      )
    );
    v_hersteld:=v_hersteld+1;
    v_wijzigingen:=v_wijzigingen || jsonb_build_array(
      jsonb_build_object('id',v_kandidaat.id,'updated_at',v_herstel_tijd)
    );
  END LOOP;

  v_result:=jsonb_build_object(
    'herstel_request_id',p_herstel_request_id,
    'bron_request_id',p_bron_request_id,
    'hersteld',v_hersteld,
    'wijzigingen',v_wijzigingen
  );
  UPDATE public.crm_pipeline_bulk_herstel_requests
    SET result=v_result WHERE id=p_herstel_request_id;
  RETURN v_result;
END
$fn$;
REVOKE ALL ON FUNCTION public.crm_pipeline_bulk_herstellen(uuid,uuid,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_pipeline_bulk_herstellen(uuid,uuid,uuid)
  TO authenticated;
