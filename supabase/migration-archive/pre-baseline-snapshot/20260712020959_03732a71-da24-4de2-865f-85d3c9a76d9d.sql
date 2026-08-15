-- BUILD-3 exec conform BUILD-3-SPEC v4; reader-smoke buiten DO-blok verwijderd; USAGE-assertion in DO $tests$; LEAST/GREATEST zonder pg_catalog.-prefix
BEGIN;

-- ---------------------------------------------------------------------------
-- 2.1  Schema
-- ---------------------------------------------------------------------------
CREATE SCHEMA ai_gateway_readonly AUTHORIZATION postgres;

-- ---------------------------------------------------------------------------
-- 2.2  Reader-role
-- ---------------------------------------------------------------------------
CREATE ROLE ai_gateway_reader
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

GRANT USAGE ON SCHEMA ai_gateway_readonly TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.3  Functie 1  —  search_off_market_signals
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.search_off_market_signals(
  p_query        text                        DEFAULT NULL,
  p_provincie    text                        DEFAULT NULL,
  p_plaats       text                        DEFAULT NULL,
  p_assettype    public.off_market_assettype DEFAULT NULL,
  p_status_in    public.off_market_status[]  DEFAULT NULL,
  p_min_ai_score int                         DEFAULT NULL,
  p_actief_only  boolean                     DEFAULT true,
  p_limit        int                         DEFAULT 50,
  p_offset       int                         DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  display_label text,
  plaats        text,
  provincie     text,
  assettype     public.off_market_assettype,
  status        public.off_market_status,
  prioriteit    public.off_market_prioriteit,
  ai_score      int,
  created_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  SELECT
    s.id,
    (COALESCE(s.plaats, 'onbekend')
       || ' — '
       || COALESCE(s.assettype::text, 'onbekend'))                     AS display_label,
    s.plaats,
    s.provincie,
    s.assettype,
    s.status,
    s.prioriteit,
    s.ai_score,
    s.created_at
  FROM public.off_market_signalen AS s
  WHERE
        (p_provincie    IS NULL OR s.provincie = p_provincie)
    AND (p_plaats       IS NULL OR s.plaats    = p_plaats)
    AND (p_assettype    IS NULL OR s.assettype = p_assettype)
    AND (p_status_in    IS NULL OR s.status    = ANY (p_status_in))
    AND (p_min_ai_score IS NULL OR s.ai_score >= p_min_ai_score)
    AND (
      NOT COALESCE(p_actief_only, true)
      OR (
        s.gearchiveerd_op IS NULL
        AND s.status NOT IN (
          'archief'::public.off_market_status,
          'afgevallen'::public.off_market_status,
          'niet_interessant'::public.off_market_status,
          'object_ontvangen'::public.off_market_status,
          'dealtraject'::public.off_market_status
        )
      )
    )
    AND (
      p_query IS NULL
      OR s.search_tsv @@ pg_catalog.plainto_tsquery('simple', p_query)
    )
  ORDER BY s.ai_score DESC NULLS LAST, s.created_at DESC
  LIMIT  LEAST(GREATEST(COALESCE(p_limit,  50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$fn$;

REVOKE ALL ON FUNCTION ai_gateway_readonly.search_off_market_signals(
  text, text, text,
  public.off_market_assettype,
  public.off_market_status[],
  int, boolean, int, int
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ai_gateway_readonly.search_off_market_signals(
  text, text, text,
  public.off_market_assettype,
  public.off_market_status[],
  int, boolean, int, int
) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.4  Functie 2  —  get_off_market_signal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_signal(
  p_id uuid
)
RETURNS TABLE (
  id                          uuid,
  titel                       text,
  plaats                      text,
  provincie                   text,
  regio                       text,
  assettype                   public.off_market_assettype,
  status                      public.off_market_status,
  prioriteit                  public.off_market_prioriteit,
  eigenaarstatus              public.off_market_eigenaarstatus,
  ai_score                    int,
  ai_score_componenten        jsonb,
  ai_samenvatting             text,
  ai_aanbevolen_actie         text,
  potentiele_strategie        text,
  volgende_actie_datum        date,
  volgende_actie_omschrijving text,
  heeft_actieve_taak          boolean,
  aantal_actieve_taken        int,
  aantal_contactmomenten      int,
  aantal_verstuurde_brieven   int,
  laatste_brief_kanaal        text,
  laatste_brief_campagne_stap text,
  laatste_respons_status      text,
  created_at                  timestamptz,
  updated_at                  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  SELECT
    s.id,
    s.titel,
    s.plaats,
    s.provincie,
    s.regio,
    s.assettype,
    s.status,
    s.prioriteit,
    s.eigenaarstatus,
    s.ai_score,
    s.ai_score_componenten,
    s.ai_samenvatting,
    s.ai_aanbevolen_actie,
    s.potentiele_strategie,
    s.volgende_actie_datum,
    s.volgende_actie_omschrijving,
    EXISTS (
      SELECT 1 FROM public.taken t
      WHERE t.off_market_signaal_id = s.id
        AND t.soft_deleted_at IS NULL
        AND t.status IN (
          'open'::public.taak_status,
          'in_uitvoering'::public.taak_status,
          'wacht_op_reactie'::public.taak_status
        )
    )                                                                  AS heeft_actieve_taak,
    (SELECT COUNT(*)::int FROM public.taken t
      WHERE t.off_market_signaal_id = s.id
        AND t.soft_deleted_at IS NULL
        AND t.status IN (
          'open'::public.taak_status,
          'in_uitvoering'::public.taak_status,
          'wacht_op_reactie'::public.taak_status
        ))                                                             AS aantal_actieve_taken,
    (SELECT COUNT(*)::int FROM public.contact_moments cm
      WHERE cm.off_market_signaal_id = s.id)                           AS aantal_contactmomenten,
    (SELECT COUNT(*)::int FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.status = 'verstuurd')            AS aantal_verstuurde_brieven,
    (SELECT b.kanaal FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.status = 'verstuurd'
      ORDER BY COALESCE(b.postdatum, b.verzonden_op::date) DESC NULLS LAST
      LIMIT 1)                                                         AS laatste_brief_kanaal,
    (SELECT b.campagne_stap FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.status = 'verstuurd'
      ORDER BY COALESCE(b.postdatum, b.verzonden_op::date) DESC NULLS LAST
      LIMIT 1)                                                         AS laatste_brief_campagne_stap,
    (SELECT b.responsstatus FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.responsstatus IS NOT NULL
      ORDER BY COALESCE(b.postdatum, b.verzonden_op::date) DESC NULLS LAST
      LIMIT 1)                                                         AS laatste_respons_status,
    s.created_at,
    s.updated_at
  FROM public.off_market_signalen s
  WHERE s.id = p_id;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_signal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_signal(uuid) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.5  Functie 3  —  get_off_market_follow_up_queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_follow_up_queue(
  p_provincie text                        DEFAULT NULL,
  p_assettype public.off_market_assettype DEFAULT NULL,
  p_limit     int                         DEFAULT 50
)
RETURNS TABLE (
  signaal_id                     uuid,
  display_label                  text,
  plaats                         text,
  provincie                      text,
  status                         public.off_market_status,
  ai_score                       int,
  primaire_reden                 text,
  reden_codes                    text[],
  heeft_actieve_taak             boolean,
  aantal_actieve_taken           int,
  volgende_actie_datum           date,
  laatste_contactmoment_op       date,
  oudste_openstaande_opvolgdatum date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  WITH actief AS (
    SELECT
      s.id, s.plaats, s.provincie, s.assettype, s.status, s.ai_score, s.volgende_actie_datum
    FROM public.off_market_signalen s
    WHERE s.gearchiveerd_op IS NULL
      AND s.status NOT IN (
        'archief'::public.off_market_status,
        'afgevallen'::public.off_market_status,
        'niet_interessant'::public.off_market_status,
        'object_ontvangen'::public.off_market_status,
        'dealtraject'::public.off_market_status
      )
      AND (p_provincie IS NULL OR s.provincie = p_provincie)
      AND (p_assettype IS NULL OR s.assettype = p_assettype)
  ),
  actieve_taken AS (
    SELECT t.off_market_signaal_id AS signaal_id, COUNT(*)::int AS n
    FROM public.taken t
    WHERE t.off_market_signaal_id IS NOT NULL
      AND t.soft_deleted_at IS NULL
      AND t.status IN (
        'open'::public.taak_status,
        'in_uitvoering'::public.taak_status,
        'wacht_op_reactie'::public.taak_status
      )
    GROUP BY t.off_market_signaal_id
  ),
  laatste_cm AS (
    SELECT cm.off_market_signaal_id AS signaal_id, MAX(cm.moment_date) AS d
    FROM public.contact_moments cm
    WHERE cm.off_market_signaal_id IS NOT NULL
    GROUP BY cm.off_market_signaal_id
  ),
  brief_zonder_opvolging AS (
    SELECT b.signaal_id, MIN(COALESCE(b.postdatum, b.verzonden_op::date)) AS oudste
    FROM public.off_market_brieven b
    LEFT JOIN public.taken t
      ON t.id = b.gekoppelde_taak_id
     AND t.soft_deleted_at IS NULL
     AND t.status IN (
       'open'::public.taak_status,
       'in_uitvoering'::public.taak_status,
       'wacht_op_reactie'::public.taak_status
     )
    WHERE b.status = 'verstuurd'
      AND (b.postdatum IS NOT NULL OR b.verzonden_op IS NOT NULL)
      AND b.opvolgdatum IS NULL
      AND t.id IS NULL
    GROUP BY b.signaal_id
  ),
  brief_opvolgdatum_verstreken AS (
    SELECT b.signaal_id, MIN(b.opvolgdatum) AS oudste
    FROM public.off_market_brieven b
    WHERE b.status = 'verstuurd'
      AND (b.postdatum IS NOT NULL OR b.verzonden_op IS NOT NULL)
      AND b.opvolgdatum IS NOT NULL
      AND b.opvolgdatum < CURRENT_DATE
    GROUP BY b.signaal_id
  ),
  gescoord AS (
    SELECT
      a.id AS signaal_id,
      (COALESCE(a.plaats, 'onbekend') || ' — ' || COALESCE(a.assettype::text, 'onbekend')) AS display_label,
      a.plaats, a.provincie, a.status, a.ai_score, a.volgende_actie_datum,
      COALESCE(at.n, 0) AS aantal_actieve_taken,
      (COALESCE(at.n, 0) > 0) AS heeft_actieve_taak,
      lc.d AS laatste_contactmoment_op,
      LEAST(bzo.oudste, bov.oudste) AS oudste_openstaande_opvolgdatum,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN bov.signaal_id IS NOT NULL THEN 'brief_opvolgdatum_verstreken' END,
        CASE WHEN bzo.signaal_id IS NOT NULL THEN 'brief_zonder_opvolging' END,
        CASE WHEN a.volgende_actie_datum IS NOT NULL AND a.volgende_actie_datum < CURRENT_DATE THEN 'actie_datum_verstreken' END,
        CASE WHEN COALESCE(at.n, 0) = 0 THEN 'geen_actieve_taak' END,
        CASE WHEN a.volgende_actie_datum IS NULL THEN 'zonder_actie_datum' END
      ]::text[], NULL) AS reden_codes
    FROM actief a
    LEFT JOIN actieve_taken                at  ON at.signaal_id  = a.id
    LEFT JOIN laatste_cm                   lc  ON lc.signaal_id  = a.id
    LEFT JOIN brief_zonder_opvolging       bzo ON bzo.signaal_id = a.id
    LEFT JOIN brief_opvolgdatum_verstreken bov ON bov.signaal_id = a.id
  )
  SELECT
    g.signaal_id, g.display_label, g.plaats, g.provincie, g.status, g.ai_score,
    g.reden_codes[1] AS primaire_reden,
    g.reden_codes, g.heeft_actieve_taak, g.aantal_actieve_taken,
    g.volgende_actie_datum, g.laatste_contactmoment_op, g.oudste_openstaande_opvolgdatum
  FROM gescoord g
  WHERE pg_catalog.array_length(g.reden_codes, 1) IS NOT NULL
  ORDER BY g.ai_score DESC NULLS LAST, g.oudste_openstaande_opvolgdatum ASC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_follow_up_queue(
  text, public.off_market_assettype, int
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_follow_up_queue(
  text, public.off_market_assettype, int
) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.6  Functie 4  —  get_off_market_batch_performance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_batch_performance(
  p_weken_terug int DEFAULT 26
)
RETURNS TABLE (
  campagne_stap                text,
  kanaal                       text,
  eerste_verzenddatum          date,
  laatste_verzenddatum         date,
  aantal_brieven               int,
  aantal_status_verstuurd      int,
  aantal_harde_verzending      int,
  aantal_zonder_verzendbewijs  int,
  aantal_met_actieve_taak      int,
  aantal_met_opvolgdatum       int,
  aantal_met_respons           int,
  aantal_positieve_respons     int,
  batch_coverage_pct           numeric,
  channel_coverage_pct         numeric,
  date_coverage_pct            numeric,
  response_coverage_pct        numeric,
  follow_up_coverage_pct       numeric,
  open_signalen                int,
  closed_signalen              int,
  aantal_in_gesprek_nu         int,
  aantal_gespreksfase_bereikt  int,
  bereikte_gespreksfase_pct    numeric,
  status_history_available     boolean,
  conversion_date_available    boolean,
  warning_codes                text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  WITH bounded AS (
    SELECT LEAST(GREATEST(COALESCE(p_weken_terug, 26), 1), 52) AS wk
  ),
  brieven AS (
    SELECT
      COALESCE(b.campagne_stap, '<zonder_batch>')                      AS campagne_stap,
      b.campagne_stap                                                  AS campagne_stap_raw,
      b.kanaal,
      COALESCE(b.postdatum, b.verzonden_op::date)                      AS verzenddatum,
      b.id, b.signaal_id,
      b.status AS brief_status,
      b.verzendstatus, b.postdatum, b.printdatum, b.verzonden_op,
      b.opvolgdatum, b.gekoppelde_taak_id, b.responsstatus
    FROM public.off_market_brieven b, bounded
    WHERE COALESCE(b.postdatum, b.verzonden_op::date, b.printdatum) >= CURRENT_DATE - (bounded.wk * 7)
  ),
  taken_actief AS (
    SELECT t.id FROM public.taken t
    WHERE t.soft_deleted_at IS NULL
      AND t.status IN (
        'open'::public.taak_status,
        'in_uitvoering'::public.taak_status,
        'wacht_op_reactie'::public.taak_status
      )
  ),
  populatie AS (
    SELECT
      br.*,
      s.status AS signaal_status,
      (s.gearchiveerd_op IS NULL
        AND s.status NOT IN (
          'archief'::public.off_market_status,
          'afgevallen'::public.off_market_status,
          'niet_interessant'::public.off_market_status,
          'object_ontvangen'::public.off_market_status,
          'dealtraject'::public.off_market_status
        )) AS is_open,
      (br.gekoppelde_taak_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM taken_actief ta WHERE ta.id = br.gekoppelde_taak_id)) AS heeft_actieve_taak
    FROM brieven br
    LEFT JOIN public.off_market_signalen s ON s.id = br.signaal_id
  ),
  agg AS (
    SELECT
      p.campagne_stap, p.kanaal,
      MIN(p.verzenddatum) AS eerste_verzenddatum,
      MAX(p.verzenddatum) AS laatste_verzenddatum,
      COUNT(*)::int AS aantal_brieven,
      COUNT(*) FILTER (WHERE p.brief_status = 'verstuurd')::int AS aantal_status_verstuurd,
      COUNT(*) FILTER (WHERE p.postdatum IS NOT NULL OR p.verzonden_op IS NOT NULL)::int AS aantal_harde_verzending,
      COUNT(*) FILTER (WHERE p.brief_status = 'verstuurd' AND p.postdatum IS NULL AND p.verzonden_op IS NULL)::int AS aantal_zonder_verzendbewijs,
      COUNT(*) FILTER (WHERE p.heeft_actieve_taak)::int AS aantal_met_actieve_taak,
      COUNT(*) FILTER (WHERE p.opvolgdatum IS NOT NULL)::int AS aantal_met_opvolgdatum,
      COUNT(*) FILTER (WHERE p.responsstatus IS NOT NULL)::int AS aantal_met_respons,
      COUNT(*) FILTER (WHERE p.responsstatus IN ('interesse','wil_meer_informatie','gesprek_gepland'))::int AS aantal_positieve_respons,
      COUNT(*) FILTER (WHERE p.campagne_stap_raw IS NOT NULL)::int AS aantal_met_batch,
      COUNT(*) FILTER (WHERE p.kanaal IS NOT NULL)::int AS aantal_met_kanaal,
      COUNT(*) FILTER (WHERE p.postdatum IS NOT NULL OR p.verzonden_op IS NOT NULL)::int AS aantal_met_datum,
      COUNT(DISTINCT p.signaal_id) FILTER (WHERE p.is_open)::int AS open_signalen,
      COUNT(DISTINCT p.signaal_id) FILTER (WHERE NOT p.is_open)::int AS closed_signalen,
      COUNT(DISTINCT p.signaal_id) FILTER (WHERE p.signaal_status = 'in_gesprek'::public.off_market_status)::int AS aantal_in_gesprek_nu,
      COUNT(DISTINCT p.signaal_id) FILTER (WHERE p.signaal_status IN (
        'in_gesprek'::public.off_market_status,
        'aanbod_ontvangen'::public.off_market_status,
        'object_ontvangen'::public.off_market_status,
        'dealtraject'::public.off_market_status
      ))::int AS aantal_gespreksfase_bereikt,
      COUNT(DISTINCT p.signaal_id)::int AS unieke_signalen
    FROM populatie p
    GROUP BY p.campagne_stap, p.kanaal
  )
  SELECT
    a.campagne_stap, a.kanaal, a.eerste_verzenddatum, a.laatste_verzenddatum,
    a.aantal_brieven, a.aantal_status_verstuurd, a.aantal_harde_verzending, a.aantal_zonder_verzendbewijs,
    a.aantal_met_actieve_taak, a.aantal_met_opvolgdatum, a.aantal_met_respons, a.aantal_positieve_respons,
    ROUND(100.0 * a.aantal_met_batch::numeric   / NULLIF(a.aantal_brieven, 0), 2) AS batch_coverage_pct,
    ROUND(100.0 * a.aantal_met_kanaal::numeric  / NULLIF(a.aantal_brieven, 0), 2) AS channel_coverage_pct,
    ROUND(100.0 * a.aantal_met_datum::numeric   / NULLIF(a.aantal_brieven, 0), 2) AS date_coverage_pct,
    ROUND(100.0 * a.aantal_met_respons::numeric / NULLIF(a.aantal_brieven, 0), 2) AS response_coverage_pct,
    ROUND(100.0 * a.aantal_met_opvolgdatum::numeric / NULLIF(a.aantal_brieven, 0), 2) AS follow_up_coverage_pct,
    a.open_signalen, a.closed_signalen, a.aantal_in_gesprek_nu, a.aantal_gespreksfase_bereikt,
    ROUND(100.0 * a.aantal_gespreksfase_bereikt::numeric / NULLIF(a.unieke_signalen, 0), 2) AS bereikte_gespreksfase_pct,
    false AS status_history_available,
    false AS conversion_date_available,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN a.aantal_zonder_verzendbewijs > 0 THEN 'ontbrekend_verzendbewijs' END,
      CASE WHEN a.aantal_met_batch    < a.aantal_brieven THEN 'batch_dekking_onvolledig' END,
      CASE WHEN a.aantal_met_kanaal   < a.aantal_brieven THEN 'kanaal_dekking_onvolledig' END,
      CASE WHEN a.aantal_met_datum    < a.aantal_brieven THEN 'datum_dekking_onvolledig' END,
      CASE WHEN a.aantal_met_respons  < a.aantal_brieven THEN 'respons_dekking_onvolledig' END,
      CASE WHEN a.aantal_met_opvolgdatum < a.aantal_brieven THEN 'opvolging_dekking_onvolledig' END,
      CASE WHEN a.aantal_status_verstuurd <> a.aantal_harde_verzending THEN 'status_verzendstatus_afwijking' END,
      'geen_statushistorie',
      'geen_conversiedatum',
      'respons_afwezigheid_geen_bewijs_van_geen_interesse'
    ]::text[], NULL) AS warning_codes
  FROM agg a
  ORDER BY a.campagne_stap, a.kanaal;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.7  Functie 5  —  get_off_market_ai_conversion_analysis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis()
RETURNS TABLE (
  ai_score_bucket             text,
  aantal                      int,
  in_gesprek                  int,
  aanbod_ontvangen            int,
  object_ontvangen            int,
  dealtraject                 int,
  afgevallen                  int,
  niet_interessant            int,
  gespreksfase_bereikt        int,
  conversie_gesprek_pct       numeric,
  conversie_object_pct        numeric,
  open_signalen               int,
  closed_signalen             int,
  score_coverage_pct          numeric,
  open_population_pct         numeric,
  closed_population_pct       numeric,
  response_coverage_pct       numeric,
  follow_up_coverage_pct      numeric,
  status_history_available    boolean,
  conversion_date_available   boolean,
  warning_codes               text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  WITH gebucketed AS (
    SELECT
      s.id, s.status, s.ai_score,
      (s.gearchiveerd_op IS NULL
        AND s.status NOT IN (
          'archief'::public.off_market_status,
          'afgevallen'::public.off_market_status,
          'niet_interessant'::public.off_market_status,
          'object_ontvangen'::public.off_market_status,
          'dealtraject'::public.off_market_status
        )) AS is_open,
      CASE
        WHEN s.ai_score IS NULL                    THEN 'onbekend'
        WHEN s.ai_score < 0 OR s.ai_score > 100    THEN 'ongeldige_score'
        WHEN s.ai_score BETWEEN 0  AND 24          THEN '0-24'
        WHEN s.ai_score BETWEEN 25 AND 49          THEN '25-49'
        WHEN s.ai_score BETWEEN 50 AND 74          THEN '50-74'
        ELSE '75-100'
      END AS bucket
    FROM public.off_market_signalen s
  ),
  totalen AS (
    SELECT
      COUNT(*)::numeric AS totaal,
      COUNT(*) FILTER (WHERE bucket IN ('0-24','25-49','50-74','75-100'))::numeric AS met_score,
      COUNT(*) FILTER (WHERE is_open)::numeric AS open_totaal,
      COUNT(*) FILTER (WHERE NOT is_open)::numeric AS closed_totaal
    FROM gebucketed
  ),
  respons_stat AS (
    SELECT
      COUNT(*)::numeric AS totaal_brieven,
      COUNT(*) FILTER (WHERE responsstatus IS NOT NULL)::numeric AS met_respons,
      COUNT(*) FILTER (WHERE opvolgdatum   IS NOT NULL)::numeric AS met_opvolg
    FROM public.off_market_brieven
    WHERE status = 'verstuurd'
      AND (postdatum IS NOT NULL OR verzonden_op IS NOT NULL)
  ),
  per_bucket AS (
    SELECT
      g.bucket,
      COUNT(*)::int AS aantal,
      COUNT(*) FILTER (WHERE g.status = 'in_gesprek'::public.off_market_status)::int AS in_gesprek,
      COUNT(*) FILTER (WHERE g.status = 'aanbod_ontvangen'::public.off_market_status)::int AS aanbod_ontvangen,
      COUNT(*) FILTER (WHERE g.status = 'object_ontvangen'::public.off_market_status)::int AS object_ontvangen,
      COUNT(*) FILTER (WHERE g.status = 'dealtraject'::public.off_market_status)::int AS dealtraject,
      COUNT(*) FILTER (WHERE g.status = 'afgevallen'::public.off_market_status)::int AS afgevallen,
      COUNT(*) FILTER (WHERE g.status = 'niet_interessant'::public.off_market_status)::int AS niet_interessant,
      COUNT(*) FILTER (WHERE g.status IN (
        'in_gesprek'::public.off_market_status,
        'aanbod_ontvangen'::public.off_market_status,
        'object_ontvangen'::public.off_market_status,
        'dealtraject'::public.off_market_status
      ))::int AS gespreksfase_bereikt,
      COUNT(*) FILTER (WHERE g.is_open)::int AS open_signalen,
      COUNT(*) FILTER (WHERE NOT g.is_open)::int AS closed_signalen
    FROM gebucketed g
    GROUP BY g.bucket
  )
  SELECT
    pb.bucket AS ai_score_bucket,
    pb.aantal,
    pb.in_gesprek, pb.aanbod_ontvangen, pb.object_ontvangen, pb.dealtraject,
    pb.afgevallen, pb.niet_interessant,
    pb.gespreksfase_bereikt,
    ROUND(100.0 * pb.gespreksfase_bereikt::numeric / NULLIF(pb.aantal, 0), 2) AS conversie_gesprek_pct,
    ROUND(100.0 * pb.object_ontvangen::numeric     / NULLIF(pb.aantal, 0), 2) AS conversie_object_pct,
    pb.open_signalen, pb.closed_signalen,
    ROUND(100.0 * t.met_score      / NULLIF(t.totaal, 0), 2) AS score_coverage_pct,
    ROUND(100.0 * t.open_totaal    / NULLIF(t.totaal, 0), 2) AS open_population_pct,
    ROUND(100.0 * t.closed_totaal  / NULLIF(t.totaal, 0), 2) AS closed_population_pct,
    ROUND(100.0 * rs.met_respons   / NULLIF(rs.totaal_brieven, 0), 2) AS response_coverage_pct,
    ROUND(100.0 * rs.met_opvolg    / NULLIF(rs.totaal_brieven, 0), 2) AS follow_up_coverage_pct,
    false AS status_history_available,
    false AS conversion_date_available,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN pb.bucket = 'onbekend' AND pb.aantal > 0        THEN 'score_ontbrekend' END,
      CASE WHEN pb.bucket = 'ongeldige_score' AND pb.aantal > 0 THEN 'score_ongeldig' END,
      'geen_statushistorie',
      'geen_conversiedatum',
      'respons_afwezigheid_geen_bewijs_van_geen_interesse'
    ]::text[], NULL) AS warning_codes
  FROM per_bucket pb
  CROSS JOIN totalen t
  CROSS JOIN respons_stat rs
  ORDER BY pb.bucket;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis() TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.8  Catalog- en privilege-assertions (fail-closed)
-- ---------------------------------------------------------------------------
DO $tests$
DECLARE
  n_funcs        int;
  n_exec_reader  int;
  n_bad_grants   int;
  n_secdef       int;
  n_owner_ok     int;
  n_searchpath   int;
BEGIN
  -- (a) Exact vijf functies in ai_gateway_readonly
  SELECT COUNT(*) INTO n_funcs
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly';
  IF n_funcs <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: verwacht 5 functies, gevonden %', n_funcs;
  END IF;

  -- (b) ai_gateway_reader heeft EXECUTE op alle vijf
  SELECT COUNT(*) INTO n_exec_reader
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly'
    AND has_function_privilege('ai_gateway_reader', p.oid, 'EXECUTE');
  IF n_exec_reader <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: reader heeft EXECUTE op %/5', n_exec_reader;
  END IF;

  -- (c) PUBLIC heeft geen EXECUTE
  SELECT COUNT(*) INTO n_bad_grants
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly'
    AND has_function_privilege('public', p.oid, 'EXECUTE');
  IF n_bad_grants <> 0 THEN
    RAISE EXCEPTION 'BUILD-3 test: PUBLIC heeft EXECUTE op % functie(s)', n_bad_grants;
  END IF;

  -- (d) Alle vijf zijn SECURITY DEFINER
  SELECT COUNT(*) INTO n_secdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly' AND p.prosecdef = true;
  IF n_secdef <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: %/5 functies zijn SECURITY DEFINER', n_secdef;
  END IF;

  -- (e) Owner van elke functie is postgres
  SELECT COUNT(*) INTO n_owner_ok
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles     r ON r.oid = p.proowner
  WHERE n.nspname = 'ai_gateway_readonly' AND r.rolname = 'postgres';
  IF n_owner_ok <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: %/5 functies eigendom van postgres', n_owner_ok;
  END IF;

  -- (f) proconfig bevat exact search_path=pg_catalog
  SELECT COUNT(*) INTO n_searchpath
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly'
    AND p.proconfig @> ARRAY['search_path=pg_catalog']::text[]
    AND pg_catalog.array_length(p.proconfig, 1) = 1;
  IF n_searchpath <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: %/5 functies met exact search_path=pg_catalog', n_searchpath;
  END IF;

  -- (g) Reader heeft geen SELECT op de vier basistabellen
  IF has_table_privilege('ai_gateway_reader', 'public.off_market_signalen', 'SELECT')
  OR has_table_privilege('ai_gateway_reader', 'public.off_market_brieven',  'SELECT')
  OR has_table_privilege('ai_gateway_reader', 'public.taken',                'SELECT')
  OR has_table_privilege('ai_gateway_reader', 'public.contact_moments',      'SELECT') THEN
    RAISE EXCEPTION 'BUILD-3 test: reader heeft SELECT op RLS-tabel';
  END IF;

  -- (h) Smoke als owner (postgres): compile + kolomsignaturen kloppen
  PERFORM 1 FROM ai_gateway_readonly.search_off_market_signals(NULL,NULL,NULL,NULL,NULL,NULL,true,1,0);
  PERFORM 1 FROM ai_gateway_readonly.get_off_market_follow_up_queue(NULL,NULL,1);
  PERFORM 1 FROM ai_gateway_readonly.get_off_market_batch_performance(1);
  PERFORM 1 FROM ai_gateway_readonly.get_off_market_ai_conversion_analysis();

  -- (i) Reader heeft USAGE op ai_gateway_readonly
  IF NOT has_schema_privilege('ai_gateway_reader', 'ai_gateway_readonly', 'USAGE') THEN
    RAISE EXCEPTION 'BUILD-3 test: reader mist USAGE op ai_gateway_readonly';
  END IF;
END
$tests$;

COMMIT;
