CREATE OR REPLACE FUNCTION public.off_market_promote_to_object(_signaal_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.off_market_signalen%ROWTYPE;
  v_object_id uuid;
  v_asset public.asset_class;
BEGIN
  IF NOT public.is_intern_gebruiker(auth.uid()) THEN
    RAISE EXCEPTION 'Geen toegang';
  END IF;

  SELECT * INTO s FROM public.off_market_signalen WHERE id = _signaal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signaal niet gevonden';
  END IF;

  IF s.gekoppeld_object_id IS NOT NULL THEN
    RETURN s.gekoppeld_object_id;
  END IF;

  v_asset := CASE s.assettype
    WHEN 'kantoor'              THEN 'kantoren'::public.asset_class
    WHEN 'winkelpand'           THEN 'winkels'::public.asset_class
    WHEN 'woon_winkelpand'      THEN 'mixed_use'::public.asset_class
    WHEN 'bedrijfscomplex'      THEN 'bedrijfshallen'::public.asset_class
    WHEN 'light_industrial'     THEN 'industrieel'::public.asset_class
    WHEN 'logistiek'            THEN 'logistiek'::public.asset_class
    WHEN 'zorgvastgoed'         THEN 'zorgvastgoed'::public.asset_class
    WHEN 'transformatieobject'  THEN 'ontwikkellocatie'::public.asset_class
    WHEN 'ontwikkellocatie'     THEN 'ontwikkellocatie'::public.asset_class
    WHEN 'vastgoedportefeuille' THEN 'wonen'::public.asset_class
    WHEN 'wonen'                THEN 'wonen'::public.asset_class
    WHEN 'appartementencomplex' THEN 'wonen'::public.asset_class
    WHEN 'woonhuis'             THEN 'wonen'::public.asset_class
    WHEN 'studentenhuisvesting' THEN 'wonen'::public.asset_class
    WHEN 'gemengd_vastgoed'     THEN 'mixed_use'::public.asset_class
    ELSE                             'mixed_use'::public.asset_class
  END;

  INSERT INTO public.objecten (
    objectnaam, plaats, provincie, type_vastgoed, vraagprijs,
    bron, eigenaar_relatie_id, samenvatting, interne_opmerkingen, status
  ) VALUES (
    s.titel,
    s.plaats,
    s.provincie,
    v_asset,
    CASE WHEN s.indicatieve_waarde IS NULL THEN NULL ELSE s.indicatieve_waarde::bigint END,
    'off_market_radar',
    s.eigenaar_relatie_id,
    s.omschrijving,
    s.notities,
    'te_beoordelen'::public.object_status
  )
  RETURNING id INTO v_object_id;

  UPDATE public.off_market_signalen
     SET gekoppeld_object_id = v_object_id,
         status              = 'object_ontvangen'::public.off_market_status,
         updated_at          = now()
   WHERE id = _signaal_id;

  RETURN v_object_id;
END;
$function$;