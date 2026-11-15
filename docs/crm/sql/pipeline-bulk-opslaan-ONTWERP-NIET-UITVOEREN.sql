-- BITO CRM | ONTWERP, NIET UITVOEREN OP PRODUCTIE.
-- Alleen gebruikt door de volledig tijdelijke PostgreSQL-service in GitHub Actions.
-- Geen Supabase migratie; geen API-koppeling vanuit de CRM UI.
-- Doel: één atomische batch, idempotentie, optimistische concurrency en auditspoor.
-- SECURITY DEFINER: alleen de RPC schrijft. Alle parameters en auth.uid() worden expliciet geautoriseerd.
-- In dit single-tenant CRM betekent is_intern_gebruiker een interne beheerder.

CREATE TABLE IF NOT EXISTS public.crm_pipeline_bulk_requests (
  id uuid PRIMARY KEY,
  object_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (length(payload_hash)=32),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.crm_pipeline_bulk_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_pipeline_bulk_requests FROM PUBLIC, anon, authenticated;
-- Rechtstreekse INSERT/UPDATE op verzoeken is ook voor interne CRM-clients verboden.
-- Uitsluitend de RPC mag de idempotentie- en resultaatregistratie wijzigen.
GRANT SELECT ON public.crm_pipeline_bulk_requests TO authenticated;
CREATE POLICY crm_bulk_requests_read ON public.crm_pipeline_bulk_requests
  FOR SELECT TO authenticated USING (
    public.is_intern_gebruiker((SELECT auth.uid()))
    AND actor_id=(SELECT auth.uid()));
CREATE POLICY crm_bulk_requests_insert ON public.crm_pipeline_bulk_requests
  FOR INSERT TO authenticated WITH CHECK (
    public.is_intern_gebruiker((SELECT auth.uid()))
    AND actor_id=(SELECT auth.uid()) AND result IS NULL);
CREATE POLICY crm_bulk_requests_update ON public.crm_pipeline_bulk_requests
  FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker((SELECT auth.uid())) AND actor_id=(SELECT auth.uid()))
  WITH CHECK (public.is_intern_gebruiker((SELECT auth.uid())) AND actor_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.crm_pipeline_bulk_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.crm_pipeline_bulk_requests(id),
  object_id uuid NOT NULL,
  kandidaat_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  actie text NOT NULL CHECK (actie IN ('fase','interesse','afwijzen')),
  voor jsonb NOT NULL,
  na jsonb NOT NULL,
  bron text CHECK (bron IS NULL OR bron='intern'),
  reden_code text,
  reden_toelichting text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (request_id,kandidaat_id),
  CHECK (actie <> 'afwijzen' OR (bron='intern' AND reden_code IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS crm_pipeline_bulk_audit_candidate_idx
  ON public.crm_pipeline_bulk_audit(kandidaat_id,created_at);
ALTER TABLE public.crm_pipeline_bulk_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_pipeline_bulk_audit FROM PUBLIC, anon, authenticated;
-- Auditregels zijn alleen via de RPC te schrijven, nooit via losse Data API-mutaties.
GRANT SELECT ON public.crm_pipeline_bulk_audit TO authenticated;
CREATE POLICY crm_bulk_audit_read ON public.crm_pipeline_bulk_audit
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker((SELECT auth.uid())));
CREATE POLICY crm_bulk_audit_insert ON public.crm_pipeline_bulk_audit
  FOR INSERT TO authenticated WITH CHECK (
    public.is_intern_gebruiker((SELECT auth.uid()))
    AND actor_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.crm_pipeline_bulk_opslaan(
  p_object_id uuid,
  p_request_id uuid,
  p_items jsonb,
  p_actie jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_hash text;
  v_request public.crm_pipeline_bulk_requests%ROWTYPE;
  v_item jsonb;
  v_id uuid;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_expected timestamptz;
  v_row public.object_pipeline%ROWTYPE;
  v_soort text;
  v_fase public.pipeline_fase;
  v_interesse public.interesse_niveau;
  v_reden text;
  v_toelichting text;
  v_aantal integer := 0;
  v_ongewijzigd integer := 0;
  v_changes jsonb := '[]'::jsonb;
  v_voor jsonb;
  v_na jsonb;
  v_nieuwe_tijd timestamptz;
  v_result jsonb;
  v_object_pipeline_id uuid;
  v_object_stage_id uuid;
  v_object_stage_locked boolean;
  v_default_pipeline_id uuid;
  v_target_slug text;
  v_target_stage_id uuid;
  v_target_sort_order integer;
  v_current_sort_order integer;
  v_current_terminal boolean;
  v_object_stage_change jsonb := NULL;
BEGIN
  IF v_actor IS NULL OR NOT coalesce(public.is_intern_gebruiker(v_actor),false) THEN
    RAISE EXCEPTION 'Geen toegang tot bulkbewerking' USING ERRCODE='42501';
  END IF;
  IF p_object_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Object-ID en uniek verzoek-ID zijn verplicht' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Kandidaten moeten een lijst zijn' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Selecteer 1 tot 100 kandidaten' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_actie) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Bulkactie ontbreekt' USING ERRCODE='22023';
  END IF;

  v_soort:=p_actie->>'type';
  CASE v_soort
    WHEN 'fase' THEN
      IF (p_actie->>'fase') IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(enum_range(NULL::public.pipeline_fase)) f
        WHERE f::text=(p_actie->>'fase') AND f::text NOT IN ('afgevallen','afgerond')
      ) THEN
        RAISE EXCEPTION 'Ongeldige pipelinefase voor bulkbewerking' USING ERRCODE='22023';
      END IF;
      v_fase:=(p_actie->>'fase')::public.pipeline_fase;
    WHEN 'interesse' THEN
      IF (p_actie->>'niveau') IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(enum_range(NULL::public.interesse_niveau)) n
        WHERE n::text=(p_actie->>'niveau')
      ) THEN
        RAISE EXCEPTION 'Ongeldig interesseniveau' USING ERRCODE='22023';
      END IF;
      v_interesse:=(p_actie->>'niveau')::public.interesse_niveau;
    WHEN 'afwijzen' THEN
      IF p_actie->>'bron' IS DISTINCT FROM 'intern' THEN
        RAISE EXCEPTION 'Kopersreacties worden uitsluitend afzonderlijk geregistreerd' USING ERRCODE='22023';
      END IF;
      v_reden:=p_actie->>'categorie';
      IF v_reden IS NULL OR v_reden NOT IN (
        'prijs','rendement','locatie','vastgoedtype','oppervlakte',
        'verhuur','onderhoud','financiering','vergunningen','risico',
        'timing','documentatie','voorwaarden','anders'
      ) THEN
        RAISE EXCEPTION 'Kies een geldige interne afwijzingscategorie' USING ERRCODE='22023';
      END IF;
      v_toelichting:=nullif(btrim(coalesce(p_actie->>'anders','')),'');
      IF v_reden='anders' AND v_toelichting IS NULL THEN
        RAISE EXCEPTION 'Andere reden vereist een toelichting' USING ERRCODE='22023';
      END IF;
      IF length(coalesce(v_toelichting,''))>500 OR
         (v_reden<>'anders' AND v_toelichting IS NOT NULL) THEN
        RAISE EXCEPTION 'Ongeldige aanvullende afwijzingsreden' USING ERRCODE='22023';
      END IF;
    ELSE
      RAISE EXCEPTION 'Onbekende bulkactie' USING ERRCODE='22023';
  END CASE;

  -- Payload bevat een ETag per kandidaat; duplicates en verkeerde types weigeren.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR NOT (v_item ? 'id') OR NOT (v_item ? 'expected_updated_at') THEN
      RAISE EXCEPTION 'Elke kandidaat heeft een ID en versie nodig' USING ERRCODE='22023';
    END IF;
    BEGIN
      v_id:=(v_item->>'id')::uuid;
      v_expected:=(v_item->>'expected_updated_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Ongeldig kandidaat-ID of versietijdstip' USING ERRCODE='22023';
    END;
    IF v_id IS NULL OR v_expected IS NULL THEN
      RAISE EXCEPTION 'Kandidaat-ID of versietijdstip ontbreekt' USING ERRCODE='22023';
    END IF;
    IF v_id=ANY(v_seen) THEN
      RAISE EXCEPTION 'Dezelfde kandidaat is dubbel geselecteerd' USING ERRCODE='23505';
    END IF;
    v_seen:=array_append(v_seen,v_id);
  END LOOP;

  v_hash:=md5(jsonb_build_object(
    'object_id',p_object_id,'items',p_items,'actie',p_actie
  )::text);

  -- Het uniek verzoek-ID geldt ook voor retries na netwerkuitval.
  -- ON CONFLICT wacht op de eerste transactie; daarna is resultaat beschikbaar.
  INSERT INTO public.crm_pipeline_bulk_requests(id,object_id,actor_id,payload_hash)
  VALUES(p_request_id,p_object_id,v_actor,v_hash)
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO v_request FROM public.crm_pipeline_bulk_requests
   WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verzoek-ID is niet toegankelijk' USING ERRCODE='42501';
  END IF;
  IF v_request.actor_id<>v_actor OR v_request.object_id<>p_object_id OR
     v_request.payload_hash<>v_hash THEN
    RAISE EXCEPTION 'Verzoek-ID al gebruikt met andere invoer' USING ERRCODE='23505';
  END IF;
  IF v_request.result IS NOT NULL THEN
    RETURN v_request.result;
  END IF;

  -- Sorteer ID's voor stabiele lockvolgorde bij overlappende bulkacties.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'id'
  LOOP
    v_id:=(v_item->>'id')::uuid;
    v_expected:=(v_item->>'expected_updated_at')::timestamptz;
    SELECT * INTO v_row FROM public.object_pipeline
      WHERE id=v_id AND object_id=p_object_id AND soft_deleted_at IS NULL
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kandidaat ontbreekt of hoort bij een ander object'
        USING ERRCODE='23503';
    END IF;
    IF v_row.updated_at IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Kandidaat inmiddels gewijzigd; ververs de lijst'
        USING ERRCODE='40001';
    END IF;
    IF v_row.pipeline_fase IN ('afgevallen','afgerond') THEN
      RAISE EXCEPTION 'Afgevallen/afgeronde kandidaten zijn beschermd'
        USING ERRCODE='23514';
    END IF;

    v_voor:=jsonb_build_object(
      'pipeline_fase',v_row.pipeline_fase,
      'interesse_niveau',v_row.interesse_niveau,
      'reden_afgevallen',v_row.reden_afgevallen,
      'updated_at',v_row.updated_at);
    IF v_soort='fase' THEN
      IF v_row.pipeline_fase=v_fase THEN
        v_ongewijzigd:=v_ongewijzigd+1; CONTINUE;
      END IF;
      UPDATE public.object_pipeline
        SET pipeline_fase=v_fase, updated_at=clock_timestamp()
        WHERE id=v_id RETURNING updated_at INTO v_nieuwe_tijd;
    ELSIF v_soort='interesse' THEN
      IF v_row.interesse_niveau=v_interesse THEN
        v_ongewijzigd:=v_ongewijzigd+1; CONTINUE;
      END IF;
      UPDATE public.object_pipeline
        SET interesse_niveau=v_interesse, updated_at=clock_timestamp()
        WHERE id=v_id RETURNING updated_at INTO v_nieuwe_tijd;
    ELSE
      UPDATE public.object_pipeline SET
        pipeline_fase='afgevallen',interesse_niveau='koud',
        reden_afgevallen='Intern uitgesloten: '||v_reden||
          CASE WHEN v_toelichting IS NULL THEN '' ELSE ' — '||v_toelichting END,
        updated_at=clock_timestamp()
        WHERE id=v_id RETURNING updated_at INTO v_nieuwe_tijd;
    END IF;
    SELECT jsonb_build_object(
      'pipeline_fase',pipeline_fase,'interesse_niveau',interesse_niveau,
      'reden_afgevallen',reden_afgevallen,'updated_at',updated_at
    ) INTO v_na FROM public.object_pipeline WHERE id=v_id;

    INSERT INTO public.crm_pipeline_bulk_audit(
      request_id,object_id,kandidaat_id,actor_id,actie,voor,na,
      bron,reden_code,reden_toelichting
    ) VALUES (
      p_request_id,p_object_id,v_id,v_actor,v_soort,v_voor,v_na,
      CASE WHEN v_soort='afwijzen' THEN 'intern' END,
      CASE WHEN v_soort='afwijzen' THEN v_reden END,
      CASE WHEN v_soort='afwijzen' THEN v_toelichting END
    );
    v_aantal:=v_aantal+1;
    v_changes:=v_changes||jsonb_build_array(
      jsonb_build_object('id',v_id,'updated_at',v_nieuwe_tijd)
    );
  END LOOP;

  -- Pariteit met src/data/mock-data.ts -> KANDIDAAT_NAAR_OBJECT_STAGE.
  -- Alleen een daadwerkelijke fasewijziging mag het Object vooruitzetten.
  -- Kandidaatafwijzingen en interesseniveaus wijzigen nooit de objectfase.
  -- De objectfase is een voortgangsmijlpaal: een herstelactie demoteert die niet.
  IF v_soort='fase' AND v_aantal>0 THEN
    v_target_slug:=CASE v_fase::text
      WHEN 'match_gevonden' THEN 'in_verkoop'
      WHEN 'teaser_verstuurd' THEN 'kandidaten_benaderd'
      WHEN 'interesse_ontvangen' THEN 'kandidaten_benaderd'
      WHEN 'nda_verstuurd' THEN 'nda_dataroom'
      WHEN 'nda_getekend' THEN 'nda_dataroom'
      WHEN 'informatie_gedeeld' THEN 'nda_dataroom'
      WHEN 'bezichtiging_gepland' THEN 'bezichtigingen'
      WHEN 'bezichtiging_geweest' THEN 'bezichtigingen'
      WHEN 'indicatieve_bieding' THEN 'biedingen_ontvangen'
      WHEN 'onderhandeling' THEN 'onderhandeling'
      WHEN 'loi_ontvangen' THEN 'loi'
      WHEN 'due_diligence' THEN 'due_diligence'
      WHEN 'koopovereenkomst_concept' THEN 'koopovereenkomst'
      WHEN 'koopovereenkomst_getekend' THEN 'koopovereenkomst'
      WHEN 'transport_closing' THEN 'closing'
      ELSE NULL
    END;

    IF v_target_slug IS NOT NULL THEN
      -- Lock het live Object vóór de stagecontrole; handmatige wijzigingen winnen.
      SELECT pipeline_id,pipeline_stage_id,pipeline_stage_locked
        INTO v_object_pipeline_id,v_object_stage_id,v_object_stage_locked
      FROM public.objecten WHERE id=p_object_id FOR UPDATE;

      IF FOUND AND NOT coalesce(v_object_stage_locked,false) THEN
        -- Zelfde keuze als de bestaande individuele CRM-update:
        -- een gekoppelde objectpipeline gaat vóór de standaardpipeline.
        SELECT id INTO v_default_pipeline_id
        FROM public.pipelines
        WHERE entity_type='object' AND is_active=true
        ORDER BY is_default DESC,created_at,id LIMIT 1;
        v_object_pipeline_id:=coalesce(v_object_pipeline_id,v_default_pipeline_id);

        SELECT id,sort_order INTO v_target_stage_id,v_target_sort_order
        FROM public.pipeline_stages
        WHERE pipeline_id=v_object_pipeline_id AND slug=v_target_slug
          AND is_active=true AND is_won=false AND is_lost=false
        ORDER BY sort_order,id LIMIT 1;

        IF v_target_stage_id IS NOT NULL THEN
          -- Geen automatische actie bij een gewonnen/verloren of ongeldige stage.
          IF v_object_stage_id IS NULL THEN
            v_current_sort_order:=NULL;
            v_current_terminal:=false;
          ELSE
            SELECT sort_order,(is_won OR is_lost)
              INTO v_current_sort_order,v_current_terminal
            FROM public.pipeline_stages
            WHERE id=v_object_stage_id AND pipeline_id=v_object_pipeline_id;
            IF NOT FOUND THEN v_current_terminal:=true; END IF;
          END IF;

          IF NOT coalesce(v_current_terminal,true)
             AND (v_current_sort_order IS NULL
                  OR v_target_sort_order>v_current_sort_order) THEN
            UPDATE public.objecten
            SET pipeline_id=v_object_pipeline_id,
                pipeline_stage_id=v_target_stage_id,
                pipeline_updated_at=clock_timestamp()
            WHERE id=p_object_id;
            v_object_stage_change:=jsonb_build_object(
              'object_id',p_object_id,
              'oude_stage_id',v_object_stage_id,
              'nieuwe_stage_id',v_target_stage_id,
              'nieuwe_slug',v_target_slug
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  v_result:=jsonb_build_object(
    'verzoek_id',p_request_id,'aangepast',v_aantal,
    'ongewijzigd',v_ongewijzigd,'wijzigingen',v_changes,
    'object_fase_wijziging',v_object_stage_change
  );
  UPDATE public.crm_pipeline_bulk_requests SET result=v_result
    WHERE id=p_request_id;
  RETURN v_result;
END
$fn$;
REVOKE ALL ON FUNCTION public.crm_pipeline_bulk_opslaan(uuid,uuid,jsonb,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_pipeline_bulk_opslaan(uuid,uuid,jsonb,jsonb)
  TO authenticated;
