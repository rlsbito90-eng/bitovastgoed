-- Fase 3C: sla alle budget- en rendementskeuzes letterlijk op naast eventuele
-- berekende budgetgrenzen of eenduidige rendementseisen.
ALTER TABLE public.relaties
  ADD COLUMN IF NOT EXISTS budget_voorkeur_toelichting text,
  ADD COLUMN IF NOT EXISTS rendementsdoel_toelichting text;

COMMENT ON COLUMN public.relaties.budget_voorkeur_toelichting IS
 'Letterlijke budgetband(en) uit websiteformulier. Niet als matchfilter gebruiken.';
COMMENT ON COLUMN public.relaties.rendementsdoel_toelichting IS
 'Letterlijk BAR-/rendementsdoel, inclusief meerdere gekozen bandbreedtes; geen afgeleide harde drempel.';

-- Eenmalige brongetrouwe aanvulling van de 15 reeds ingevoerde profielen.
-- Bewaar de originele waarden; bestaande ingevulde relatievelden blijven intact.
WITH bron AS (
  SELECT DISTINCT ON (m.relatie_id)
    m.relatie_id,
    nullif(trim(substring(m.description FROM 'Budget - formulier: ([^\n]+)')),'') AS budget_bron,
    nullif(trim(substring(m.description FROM 'Rendement / BAR: ([^\n]+)')),'') AS rendement_bron
  FROM public.contact_moments m
  WHERE m.system_key LIKE 'website_investeringsprofiel:%'
  ORDER BY m.relatie_id,m.moment_date DESC,m.created_at DESC
)
UPDATE public.relaties r
SET budget_voorkeur_toelichting=coalesce(nullif(trim(r.budget_voorkeur_toelichting),''),bron.budget_bron),
    rendementsdoel_toelichting=coalesce(nullif(trim(r.rendementsdoel_toelichting),''),bron.rendement_bron)
FROM bron
WHERE r.id=bron.relatie_id AND r.soft_deleted_at IS NULL
  AND ((bron.budget_bron IS NOT NULL AND nullif(trim(r.budget_voorkeur_toelichting),'') IS NULL)
    OR (bron.rendement_bron IS NOT NULL AND nullif(trim(r.rendementsdoel_toelichting),'') IS NULL));

CREATE OR REPLACE FUNCTION public.process_website_investor_intake(p_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_i public.website_investor_intakes%ROWTYPE;
  v_enabled boolean;
  v_auto boolean;
  v_fields jsonb;
  v_name text;
  v_email text;
  v_company text;
  v_phone text;
  v_phone_digits text;
  v_party text[];
  v_assets text[];
  v_strategy text[];
  v_situations text[];
  v_finance text[];
  v_financestatus text[];
  v_purchase text[];
  v_decision text[];
  v_budget text[];
  v_budget_text text;
  v_area text;
  v_parts text[];
  v_regions text[] := ARRAY[]::text[];
  v_slugs text[] := ARRAY[]::text[];
  v_classes public.asset_class[] := ARRAY[]::public.asset_class[];
  v_canonical text[] := ARRAY[]::text[];
  v_type public.relatie_type;
  v_partijprofiel text;
  v_budget_from bigint;
  v_budget_to bigint;
  v_budget_match text[];
  v_return numeric;
  v_return_text text;
  v_matches uuid[];
  v_existing uuid;
  v_ambiguous boolean := false;
  v_idx int;
  v_item text;
  v_slug text;
  v_asset public.asset_class;
  v_id uuid;
BEGIN
  SELECT * INTO v_i FROM public.website_investor_intakes
    WHERE id=p_intake_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
  IF v_i.status <> 'nieuw_te_controleren' THEN
    RETURN jsonb_build_object('result','not_pending','status',v_i.status);
  END IF;

  SELECT enabled, auto_create_enabled INTO v_enabled,v_auto
    FROM public.website_intake_credentials
    WHERE source='cf7_investor_profile';
  IF NOT coalesce(v_enabled,false) OR NOT coalesce(v_auto,false) THEN
    RETURN jsonb_build_object('result','review_only');
  END IF;

  v_fields := v_i.raw_payload->'fields';
  v_name := trim(v_i.applicant_name);
  v_email := lower(trim(v_i.applicant_email));
  v_company := nullif(trim(coalesce(v_fields->>'company','')),'');
  v_phone := nullif(trim(coalesce(v_i.applicant_phone,'')),'');
  v_phone_digits := regexp_replace(coalesce(v_phone,''),'[^0-9]','','g');

  -- Geen fictieve testaccounts of anonieme toestemmingloos ingezonden profielen.
  IF v_email LIKE '%@example.com' OR v_email LIKE '%@example.org' OR
     v_email LIKE '%@example.net' OR v_email LIKE '%.invalid' OR
     v_email LIKE '%@test.nl' OR lower(v_name) LIKE 'bito crm test%' THEN
    RETURN jsonb_build_object('result','test_ignored');
  END IF;
  IF jsonb_typeof(v_fields->'privacy') <> 'array' OR
     NOT (v_fields->'privacy' ? '1') THEN
    RETURN jsonb_build_object('result','review_privacy');
  END IF;

  -- Anti-race: gelijktijdige aanvragen met hetzelfde e-mailadres krijgen niet
  -- allebei een relatiekaart. Het event-ID is daarnaast uniek op de intake.
  PERFORM pg_advisory_xact_lock(hashtextextended('website-email:'||v_email,0));

  SELECT array_agg(DISTINCT id) INTO v_matches FROM (
    SELECT r.id FROM public.relaties r
      WHERE r.soft_deleted_at IS NULL AND lower(trim(coalesce(r.email,'')))=v_email
    UNION ALL
    SELECT c.relatie_id FROM public.relatie_contactpersonen c
      JOIN public.relaties r ON r.id=c.relatie_id AND r.soft_deleted_at IS NULL
      WHERE lower(trim(coalesce(c.email,'')))=v_email
  ) t;

  -- Bij exacte mailherkenning altijd handmatige review en geen overschrijving.
  IF coalesce(cardinality(v_matches),0)>0 THEN
    UPDATE public.website_investor_intakes SET
      status=CASE WHEN cardinality(v_matches)=1 THEN 'bestaande_relatie' ELSE 'dubbelzinnig' END,
      suggested_relatie_id=CASE WHEN cardinality(v_matches)=1 THEN v_matches[1] ELSE NULL END,
      updated_at=now()
    WHERE id=v_i.id;
    RETURN jsonb_build_object('result','existing_email_review');
  END IF;

  -- Naam, bedrijf of telefoon kunnen bij een ander e-mailadres horen.
  -- Een enkel mogelijk conflict is voldoende om een dubbele relatie te voorkomen.
  SELECT EXISTS (
    SELECT 1 FROM public.relaties r WHERE r.soft_deleted_at IS NULL
      AND (
        lower(trim(coalesce(r.contactpersoon,'')))=lower(v_name)
        OR (v_company IS NOT NULL AND lower(trim(r.bedrijfsnaam))=lower(v_company))
        OR (length(v_phone_digits)>=9 AND
          right(regexp_replace(coalesce(r.telefoon,''),'[^0-9]','','g'),9)
          =right(v_phone_digits,9))
      )
    UNION ALL
    SELECT 1 FROM public.relatie_contactpersonen c
      JOIN public.relaties r ON r.id=c.relatie_id AND r.soft_deleted_at IS NULL
      WHERE lower(trim(c.naam))=lower(v_name)
        OR (length(v_phone_digits)>=9 AND (
          right(regexp_replace(coalesce(c.telefoon,''),'[^0-9]','','g'),9)
            =right(v_phone_digits,9)
          OR right(regexp_replace(coalesce(c.telefoon_mobiel,''),'[^0-9]','','g'),9)
            =right(v_phone_digits,9)))
  ) INTO v_ambiguous;
  IF v_ambiguous THEN
    UPDATE public.website_investor_intakes
      SET status='dubbelzinnig', updated_at=now() WHERE id=v_i.id;
    RETURN jsonb_build_object('result','possible_duplicate_review');
  END IF;

  v_party := CASE WHEN jsonb_typeof(v_fields->'party-type')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'party-type'))
    ELSE ARRAY[]::text[] END;
  IF cardinality(v_party)<>1 THEN
    RETURN jsonb_build_object('result','party_review');
  END IF;
  CASE v_party[1]
    WHEN 'Vastgoedbelegger' THEN v_type:='belegger'; v_partijprofiel:='belegger';
    WHEN 'Projectontwikkelaar' THEN v_type:='ontwikkelaar'; v_partijprofiel:='ontwikkelaar';
    WHEN 'Vastgoedonderneming' THEN v_type:='overig'; v_partijprofiel:='vastgoedondernemer';
    ELSE RETURN jsonb_build_object('result','party_review');
  END CASE;

  v_assets := CASE WHEN jsonb_typeof(v_fields->'asset-types')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'asset-types'))
    ELSE ARRAY[]::text[] END;
  IF cardinality(v_assets)=0 THEN RETURN jsonb_build_object('result','asset_review'); END IF;
  FOREACH v_item IN ARRAY v_assets LOOP
    v_slug := NULL; v_asset := NULL;
    CASE v_item
      WHEN 'Residentieel vastgoed' THEN v_slug:='residentieel';v_asset:='wonen';
      WHEN 'Kantoren' THEN v_slug:='kantoor';v_asset:='kantoren';
      WHEN 'Winkels / retail' THEN v_slug:='retail';v_asset:='winkels';
      WHEN 'Logistiek' THEN v_slug:='logistiek';v_asset:='logistiek';
      WHEN 'Light industrial / bedrijfsruimte' THEN v_slug:='light_industrial';v_asset:='industrieel';
      WHEN 'Mixed-use' THEN v_slug:='mixed_use';v_asset:='mixed_use';
      WHEN 'Zorgvastgoed' THEN v_slug:='zorg';v_asset:='zorgvastgoed';
      WHEN 'Hotel' THEN v_slug:='leisure';v_asset:='hotels';
      WHEN 'Vastgoedportefeuilles' THEN v_slug:='portefeuille';
      WHEN 'Transformatie & herontwikkeling' THEN v_slug:='transformatie';
      WHEN 'Ontwikkellocaties / grond' THEN v_slug:='ontwikkellocatie';v_asset:='ontwikkellocatie';
      ELSE RETURN jsonb_build_object('result','asset_review');
    END CASE;
    IF NOT v_slug=ANY(v_slugs) THEN v_slugs:=array_append(v_slugs,v_slug); END IF;
    IF v_asset IS NOT NULL AND NOT v_asset=ANY(v_classes)
      THEN v_classes:=array_append(v_classes,v_asset);
    END IF;
  END LOOP;

  v_area:=nullif(trim(coalesce(v_fields->>'search-area','')),'');
  IF v_area IS NULL THEN RETURN jsonb_build_object('result','area_review'); END IF;
  IF lower(v_area) IN ('heel nederland','geheel nederland','nederland','landelijk') THEN
    v_regions:=ARRAY['Heel Nederland']::text[];
  ELSIF lower(v_area)='randstad' THEN
    v_regions:=ARRAY['Randstad']::text[];
  ELSE
    v_parts:=regexp_split_to_array(v_area,'\s*,\s*');
    IF cardinality(v_parts)=0 THEN RETURN jsonb_build_object('result','area_review'); END IF;
    FOREACH v_item IN ARRAY v_parts LOOP
      IF v_item NOT IN ('Noord-Holland','Zuid-Holland','Noord-Brabant','Utrecht','Gelderland',
         'Overijssel','Flevoland','Friesland','Groningen','Drenthe','Zeeland','Limburg') THEN
        RETURN jsonb_build_object('result','area_review');
      END IF;
    END LOOP;
    v_regions:=v_parts;
  END IF;

  v_budget:=CASE WHEN jsonb_typeof(v_fields->'investment-size')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'investment-size'))
    ELSE ARRAY[]::text[] END;
  IF cardinality(v_budget)<>1 THEN RETURN jsonb_build_object('result','budget_review'); END IF;
  v_budget_text:=array_to_string(v_budget,'; ');
  v_budget_match:=regexp_match(v_budget[1], '([0-9][0-9.]*)\s*[-–]\s*€?\s*([0-9][0-9.]*)');
  IF v_budget_match IS NULL OR cardinality(v_budget_match)<>2 THEN
    RETURN jsonb_build_object('result','budget_review');
  END IF;
  BEGIN
    v_budget_from:=replace(v_budget_match[1],'.','')::bigint;
    v_budget_to:=replace(v_budget_match[2],'.','')::bigint;
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('result','budget_review');
  END;
  IF v_budget_from<1 OR v_budget_to<v_budget_from OR v_budget_to>10000000000 THEN
    RETURN jsonb_build_object('result','budget_review');
  END IF;

  v_strategy:=CASE WHEN jsonb_typeof(v_fields->'strategy')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'strategy'))
    ELSE ARRAY[]::text[] END;
  FOREACH v_item IN ARRAY v_strategy LOOP
    v_slug:=NULL;
    CASE v_item
      WHEN 'Langjarige exploitatie' THEN v_slug:='langetermijnbelegging';
      WHEN 'Value-add / optimalisatie' THEN v_slug:='value_add';
      WHEN 'Transformatie' THEN v_slug:='transformatie';
      WHEN 'Handel / doorverkoop' THEN v_slug:='handel';
      ELSE NULL;
    END CASE;
    IF v_slug IS NOT NULL AND NOT v_slug=ANY(v_canonical)
      THEN v_canonical:=array_append(v_canonical,v_slug);
    END IF;
  END LOOP;

  v_situations:=CASE WHEN jsonb_typeof(v_fields->'situation')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'situation')) ELSE NULL END;
  v_finance:=CASE WHEN jsonb_typeof(v_fields->'financing')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'financing')) ELSE NULL END;
  v_financestatus:=CASE WHEN jsonb_typeof(v_fields->'financing-status')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'financing-status')) ELSE NULL END;
  v_purchase:=CASE WHEN jsonb_typeof(v_fields->'purchase-term')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'purchase-term')) ELSE NULL END;
  v_decision:=CASE WHEN jsonb_typeof(v_fields->'decision-speed')='array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_fields->'decision-speed')) ELSE NULL END;

  v_return_text:=CASE WHEN jsonb_typeof(v_fields->'return-target')='array'
    THEN nullif(array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_fields->'return-target')),'; '),'')
    ELSE nullif(trim(coalesce(v_fields->>'return-target','')),'') END;
  -- Rendementsbanden (bijv. '6–8%') zijn GEEN harde minimale rendementseisen.
  IF v_return_text ~ '^\s*[0-9]+([.,][0-9]+)?\s*%\s*$' THEN
    v_return:=replace(replace(trim(v_return_text),'%',''),',','.')::numeric;
  END IF;

  INSERT INTO public.relaties(
    bedrijfsnaam,contactpersoon,type_partij,partijprofiel,commercial_roles,email,telefoon,
    lead_status,bron_relatie,regio,asset_classes,property_type_ids,
    vastgoed_strategieen,budget_min,budget_max,budget_voorkeur_toelichting,
    rendementseis,rendementsdoel_toelichting,
    zoekgebied_toelichting,gewenste_objectomvang,gewenste_situatie,
    aankooptermijn,financieringsstructuur,financieringsstatus,besluitvorming,
    aankoopcriteria,uitsluitingen,overige_toelichting,strategie_toelichting)
  VALUES (
    coalesce(v_company,v_name),v_name,v_type,v_partijprofiel,ARRAY['koper']::text[],
    v_email,v_phone,'lauw',
    'Investeringsprofiel website (automatisch; controle vereist)',v_regions,v_classes,
    ARRAY(SELECT id FROM public.property_types WHERE slug=ANY(v_slugs) AND is_active),
    v_canonical,v_budget_from,v_budget_to,v_budget_text,v_return,v_return_text,
    v_area,nullif(trim(coalesce(v_fields->>'object-size','')),''),
    v_situations,array_to_string(v_purchase,', '),array_to_string(v_finance,', '),
    array_to_string(v_financestatus,', '),array_to_string(v_decision,', '),
    nullif(trim(coalesce(v_fields->>'hard-criteria','')),''),
    nullif(trim(coalesce(v_fields->>'dealbreakers','')),''),
    nullif(trim(coalesce(v_fields->>'notes','')),''),
    array_to_string(v_strategy,', ')
  )
  RETURNING id INTO v_id;

  INSERT INTO public.relatie_contactpersonen(relatie_id,naam,email,telefoon,is_primair)
    VALUES(v_id,v_name,v_email,v_phone,true);
  INSERT INTO public.contact_moments(relatie_id,moment_date,type,direction,title,description,is_system,system_key)
    VALUES(v_id,now()::date,'notitie','inkomend',
      'Website-investeringsprofiel ontvangen',
      'Originele formulierantwoorden staan in Website-investeringsprofielen. Intake ID: '||v_i.id::text,
      true,'website_intake:'||v_i.source_event_id::text);
  UPDATE public.website_investor_intakes
    SET status='verwerkt',processed_relatie_id=v_id,reviewed_at=now(),updated_at=now()
    WHERE id=v_i.id;
  RETURN jsonb_build_object('result','created','relatie_id',v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_website_investor_intake(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_website_investor_intake(uuid) TO service_role;
