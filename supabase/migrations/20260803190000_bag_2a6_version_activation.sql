-- BAG BUILD 2A.6 — atomische datasetactivatie en gecontroleerde rollback.

CREATE OR REPLACE FUNCTION bag_control.activeer_datasetversie(
  p_nieuwe_datasetversie_id bigint
)
RETURNS TABLE (
  actieve_datasetversie_id bigint,
  vorige_datasetversie_id bigint,
  scope_code_resultaat text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, bag_control, bag_staging, bag_published
AS $function$
DECLARE
  v_scope_code text;
  v_status text;
  v_is_actief boolean;
  v_vorige_datasetversie_id bigint;
  v_staging_objecten bigint;
  v_staging_voorkomens bigint;
  v_staging_relaties bigint;
  v_staging_geometrieen bigint;
  v_published_objecten bigint;
  v_published_voorkomens bigint;
  v_published_relaties bigint;
  v_published_geometrieen bigint;
BEGIN
  SELECT d.scope_code
  INTO v_scope_code
  FROM bag_control.datasetversies AS d
  WHERE d.id = p_nieuwe_datasetversie_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onbekende BAG-datasetversie: %', p_nieuwe_datasetversie_id;
  END IF;

  -- Eén transactionele schrijver per geografische scope.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_scope_code, 0)
  );

  SELECT d.scope_code, d.status, d.is_actief
  INTO v_scope_code, v_status, v_is_actief
  FROM bag_control.datasetversies AS d
  WHERE d.id = p_nieuwe_datasetversie_id
  FOR UPDATE;

  PERFORM 1
  FROM bag_control.datasetversies AS d
  WHERE d.scope_code = v_scope_code
  ORDER BY d.id
  FOR UPDATE;

  IF v_status <> 'gevalideerd' OR v_is_actief THEN
    RAISE EXCEPTION
      'Datasetversie % moet gevalideerd en inactief zijn; status=%, actief=%',
      p_nieuwe_datasetversie_id, v_status, v_is_actief;
  END IF;

  SELECT count(*) INTO v_staging_objecten
  FROM bag_staging.objecten WHERE datasetversie_id = p_nieuwe_datasetversie_id;
  SELECT count(*) INTO v_staging_voorkomens
  FROM bag_staging.voorkomens WHERE datasetversie_id = p_nieuwe_datasetversie_id;
  SELECT count(*) INTO v_staging_relaties
  FROM bag_staging.relaties WHERE datasetversie_id = p_nieuwe_datasetversie_id;
  SELECT count(*) INTO v_staging_geometrieen
  FROM bag_staging.geometrieen WHERE datasetversie_id = p_nieuwe_datasetversie_id;

  SELECT count(*) INTO v_published_objecten
  FROM bag_published.objecten WHERE datasetversie_id = p_nieuwe_datasetversie_id;
  SELECT count(*) INTO v_published_voorkomens
  FROM bag_published.voorkomens WHERE datasetversie_id = p_nieuwe_datasetversie_id;
  SELECT count(*) INTO v_published_relaties
  FROM bag_published.relaties WHERE datasetversie_id = p_nieuwe_datasetversie_id;
  SELECT count(*) INTO v_published_geometrieen
  FROM bag_published.geometrieen WHERE datasetversie_id = p_nieuwe_datasetversie_id;

  IF v_staging_objecten = 0 OR v_staging_voorkomens = 0
     OR v_staging_objecten <> v_published_objecten
     OR v_staging_voorkomens <> v_published_voorkomens
     OR v_staging_relaties <> v_published_relaties
     OR v_staging_geometrieen <> v_published_geometrieen THEN
    RAISE EXCEPTION
      'Staging/published-pariteit faalt voor datasetversie %: staging=(%,%,%,%), published=(%,%,%,%)',
      p_nieuwe_datasetversie_id,
      v_staging_objecten, v_staging_voorkomens,
      v_staging_relaties, v_staging_geometrieen,
      v_published_objecten, v_published_voorkomens,
      v_published_relaties, v_published_geometrieen;
  END IF;

  SELECT d.id INTO v_vorige_datasetversie_id
  FROM bag_control.datasetversies AS d
  WHERE d.scope_code = v_scope_code
    AND d.is_actief
  FOR UPDATE;

  IF v_vorige_datasetversie_id IS NOT NULL THEN
    UPDATE bag_control.datasetversies
    SET status = 'vervangen',
        is_actief = false,
        vervangen_op = clock_timestamp()
    WHERE id = v_vorige_datasetversie_id;
  END IF;

  UPDATE bag_control.datasetversies
  SET status = 'actief',
      is_actief = true,
      geactiveerd_op = clock_timestamp(),
      vervangen_op = NULL
  WHERE id = p_nieuwe_datasetversie_id;

  RETURN QUERY SELECT
    p_nieuwe_datasetversie_id,
    v_vorige_datasetversie_id,
    v_scope_code;
END
$function$;

CREATE OR REPLACE FUNCTION bag_control.rollback_datasetversie(
  p_huidige_datasetversie_id bigint,
  p_vorige_datasetversie_id bigint
)
RETURNS TABLE (
  actieve_datasetversie_id bigint,
  vervangen_datasetversie_id bigint,
  scope_code_resultaat text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, bag_control
AS $function$
DECLARE
  v_scope_code text;
  v_vorige_scope_code text;
  v_huidige_status text;
  v_huidige_is_actief boolean;
  v_vorige_status text;
  v_vorige_is_actief boolean;
BEGIN
  SELECT d.scope_code INTO v_scope_code
  FROM bag_control.datasetversies AS d
  WHERE d.id = p_huidige_datasetversie_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onbekende huidige BAG-datasetversie: %', p_huidige_datasetversie_id;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_scope_code, 0)
  );

  SELECT d.status, d.is_actief
  INTO v_huidige_status, v_huidige_is_actief
  FROM bag_control.datasetversies AS d
  WHERE d.id = p_huidige_datasetversie_id
  FOR UPDATE;

  SELECT d.scope_code, d.status, d.is_actief
  INTO v_vorige_scope_code, v_vorige_status, v_vorige_is_actief
  FROM bag_control.datasetversies AS d
  WHERE d.id = p_vorige_datasetversie_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onbekende vorige BAG-datasetversie: %', p_vorige_datasetversie_id;
  END IF;

  IF v_scope_code <> v_vorige_scope_code
     OR v_huidige_status <> 'actief'
     OR NOT v_huidige_is_actief
     OR v_vorige_status <> 'vervangen'
     OR v_vorige_is_actief THEN
    RAISE EXCEPTION
      'Rollbackpaar ongeldig: huidig=(%,%,%), vorig=(%,%,%)',
      v_scope_code, v_huidige_status, v_huidige_is_actief,
      v_vorige_scope_code, v_vorige_status, v_vorige_is_actief;
  END IF;

  UPDATE bag_control.datasetversies
  SET status = 'vervangen',
      is_actief = false,
      vervangen_op = clock_timestamp()
  WHERE id = p_huidige_datasetversie_id;

  UPDATE bag_control.datasetversies
  SET status = 'actief',
      is_actief = true,
      vervangen_op = NULL
  WHERE id = p_vorige_datasetversie_id;

  RETURN QUERY SELECT
    p_vorige_datasetversie_id,
    p_huidige_datasetversie_id,
    v_scope_code;
END
$function$;

REVOKE ALL ON FUNCTION bag_control.activeer_datasetversie(bigint)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION bag_control.rollback_datasetversie(bigint, bigint)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION bag_control.activeer_datasetversie(bigint)
  TO bag_publisher;
GRANT EXECUTE ON FUNCTION bag_control.rollback_datasetversie(bigint, bigint)
  TO bag_publisher;

COMMENT ON FUNCTION bag_control.activeer_datasetversie(bigint) IS
  'Activeert één volledig gepubliceerde BAG-dataset atomisch per scope.';
COMMENT ON FUNCTION bag_control.rollback_datasetversie(bigint, bigint) IS
  'Herstelt een expliciet gecontroleerde vorige BAG-datasetversie atomisch.';
