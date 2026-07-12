# BUILD-3 — Definitieve migratiespecificatie (niet uitgevoerd, v3)

Doel: één atomair migratiebestand voor productieproject `ljudxyrqoifhfikueric` dat een geïsoleerd read-only functieoppervlak toevoegt voor de Bito CRM AI Gateway. Geen wijziging aan bestaande CRM-tabellen, -triggers, -policies of -functies. Deze specificatie wordt **niet** uitgevoerd; uitvoering vereist afzonderlijke goedkeuring.

Wijzigingen t.o.v. v2 zijn samengevat in §9.

---

## 1. Owner- en rechtenmodel

| Object | Owner | Rechten |
|---|---|---|
| `SCHEMA ai_gateway_readonly` | `postgres` | `USAGE` → `ai_gateway_reader` |
| Vijf `SECURITY DEFINER`-functies | `postgres` | `EXECUTE` → `ai_gateway_reader` (na expliciete `REVOKE ALL ... FROM PUBLIC`) |
| `ROLE ai_gateway_reader` | — | `NOLOGIN`, `NOBYPASSRLS`, `NOINHERIT`, geen tabel-/kolomrechten in `public`, geen eigen `public`-grants |

Geen tweede role. Geen `BYPASSRLS`. Geen `service_role`. Geen `ALTER DEFAULT PRIVILEGES`. Geen policy­wijziging op bestaande CRM-tabellen. Geen wijziging aan bestaande `PUBLIC`-schema-grants (bestaande PUBLIC-erving blijft ongewijzigd; reader krijgt zelf geen extra grant op `public`).

RLS-onderbouwing (bevestigd in BUILD-2C): `postgres` heeft `BYPASSRLS=true` van nature. SECURITY DEFINER-functies met owner `postgres` lezen door de bestaande RLS heen zonder policy­wijziging. Reader raakt tabellen nooit direct.

---

## 2. Volledige migratie-DDL (één transactie, fail-closed)

```sql
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
  LIMIT  pg_catalog.least(pg_catalog.greatest(COALESCE(p_limit,  50), 1), 100)
  OFFSET pg_catalog.greatest(COALESCE(p_offset, 0), 0);
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
-- 2.4  Functie 2  —  get_off_market_signal (detail, P3 toegestaan; geen fee/waarde)
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
--                   Exact vijf redencodes; display_label; expliciete kolommen.
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
      s.id,
      s.plaats,
      s.provincie,
      s.assettype,
      s.status,
      s.ai_score,
      s.volgende_actie_datum
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
    SELECT
      t.off_market_signaal_id AS signaal_id,
      COUNT(*)::int           AS n
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
    SELECT
      cm.off_market_signaal_id AS signaal_id,
      MAX(cm.moment_date)      AS d
    FROM public.contact_moments cm
    WHERE cm.off_market_signaal_id IS NOT NULL
    GROUP BY cm.off_market_signaal_id
  ),
  -- Brief met betrouwbaar verzendbewijs én zonder actieve gekoppelde taak én zonder opvolgdatum
  brief_zonder_opvolging AS (
    SELECT
      b.signaal_id,
      MIN(COALESCE(b.postdatum, b.verzonden_op::date)) AS oudste
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
  -- Brief met betrouwbaar verzendbewijs én opvolgdatum in het verleden
  brief_opvolgdatum_verstreken AS (
    SELECT
      b.signaal_id,
      MIN(b.opvolgdatum) AS oudste
    FROM public.off_market_brieven b
    WHERE b.status = 'verstuurd'
      AND (b.postdatum IS NOT NULL OR b.verzonden_op IS NOT NULL)
      AND b.opvolgdatum IS NOT NULL
      AND b.opvolgdatum < CURRENT_DATE
    GROUP BY b.signaal_id
  ),
  gescoord AS (
    SELECT
      a.id                                                            AS signaal_id,
      (COALESCE(a.plaats, 'onbekend') || ' — '
        || COALESCE(a.assettype::text, 'onbekend'))                   AS display_label,
      a.plaats,
      a.provincie,
      a.status,
      a.ai_score,
      a.volgende_actie_datum,
      COALESCE(at.n, 0)                                               AS aantal_actieve_taken,
      (COALESCE(at.n, 0) > 0)                                         AS heeft_actieve_taak,
      lc.d                                                            AS laatste_contactmoment_op,
      LEAST(bzo.oudste, bov.oudste)                                   AS oudste_openstaande_opvolgdatum,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN bov.signaal_id IS NOT NULL                              THEN 'brief_opvolgdatum_verstreken' END,
        CASE WHEN bzo.signaal_id IS NOT NULL                              THEN 'brief_zonder_opvolging'       END,
        CASE WHEN a.volgende_actie_datum IS NOT NULL
              AND a.volgende_actie_datum < CURRENT_DATE                   THEN 'actie_datum_verstreken'       END,
        CASE WHEN COALESCE(at.n, 0) = 0                                   THEN 'geen_actieve_taak'            END,
        CASE WHEN a.volgende_actie_datum IS NULL                          THEN 'zonder_actie_datum'          END
      ]::text[], NULL)                                                AS reden_codes
    FROM actief a
    LEFT JOIN actieve_taken                at  ON at.signaal_id  = a.id
    LEFT JOIN laatste_cm                   lc  ON lc.signaal_id  = a.id
    LEFT JOIN brief_zonder_opvolging       bzo ON bzo.signaal_id = a.id
    LEFT JOIN brief_opvolgdatum_verstreken bov ON bov.signaal_id = a.id
  )
  SELECT
    g.signaal_id,
    g.display_label,
    g.plaats,
    g.provincie,
    g.status,
    g.ai_score,
    g.reden_codes[1]                                                 AS primaire_reden,
    g.reden_codes,
    g.heeft_actieve_taak,
    g.aantal_actieve_taken,
    g.volgende_actie_datum,
    g.laatste_contactmoment_op,
    g.oudste_openstaande_opvolgdatum
  FROM gescoord g
  WHERE pg_catalog.array_length(g.reden_codes, 1) IS NOT NULL
  ORDER BY g.ai_score DESC NULLS LAST, g.oudste_openstaande_opvolgdatum ASC NULLS LAST
  LIMIT pg_catalog.least(pg_catalog.greatest(COALESCE(p_limit, 50), 1), 100);
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_follow_up_queue(
  text, public.off_market_assettype, int
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_follow_up_queue(
  text, public.off_market_assettype, int
) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.6  Functie 4  —  get_off_market_batch_performance  (BUILD-2B-v2 contract)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_batch_performance(
  p_weken_terug int DEFAULT 26
)
RETURNS TABLE (
  campagne_stap                text,
  kanaal                       text,
  eerste_verzenddatum          date,
  laatste_verzenddatum         date,
  aantal_brieven               int,   -- populatie brieven (open+gesloten) in venster
  aantal_status_verstuurd      int,   -- b.status = 'verstuurd'
  aantal_harde_verzending      int,   -- verzendstatus IN ('gepost','verzonden')
  aantal_zonder_verzendbewijs  int,   -- status='verstuurd' zonder postdatum/verzonden_op
  aantal_met_actieve_taak      int,
  aantal_met_opvolgdatum       int,
  aantal_met_respons           int,
  aantal_positieve_respons     int,
  response_coverage_pct        numeric,
  follow_up_coverage_pct       numeric,
  open_signalen                int,   -- unieke signalen in open populatie
  closed_signalen              int,   -- unieke signalen in gesloten populatie
  aantal_in_gesprek_nu         int,   -- huidige status = in_gesprek
  aantal_gespreksfase_bereikt  int,   -- proxy: status IN (in_gesprek, aanbod_ontvangen, object_ontvangen, dealtraject)
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
    SELECT pg_catalog.least(pg_catalog.greatest(COALESCE(p_weken_terug, 26), 1), 52) AS wk
  ),
  brieven AS (
    SELECT
      COALESCE(b.campagne_stap, '<zonder_batch>')                      AS campagne_stap,
      b.kanaal,
      COALESCE(b.postdatum, b.verzonden_op::date)                      AS verzenddatum,
      b.id,
      b.signaal_id,
      b.status                                                         AS brief_status,
      b.verzendstatus,
      b.postdatum,
      b.verzonden_op,
      b.opvolgdatum,
      b.gekoppelde_taak_id,
      b.responsstatus
    FROM public.off_market_brieven b, bounded
    WHERE COALESCE(b.postdatum, b.verzonden_op::date)
          >= CURRENT_DATE - (bounded.wk * 7)
  ),
  taken_actief AS (
    SELECT t.id
    FROM public.taken t
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
      s.status                                                         AS signaal_status,
      (s.gearchiveerd_op IS NULL
        AND s.status NOT IN (
          'archief'::public.off_market_status,
          'afgevallen'::public.off_market_status,
          'niet_interessant'::public.off_market_status,
          'object_ontvangen'::public.off_market_status,
          'dealtraject'::public.off_market_status
        ))                                                             AS is_open,
      (br.gekoppelde_taak_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM taken_actief ta WHERE ta.id = br.gekoppelde_taak_id))
                                                                       AS heeft_actieve_taak
    FROM brieven br
    LEFT JOIN public.off_market_signalen s ON s.id = br.signaal_id
  ),
  agg AS (
    SELECT
      p.campagne_stap,
      p.kanaal,
      MIN(p.verzenddatum)                                              AS eerste_verzenddatum,
      MAX(p.verzenddatum)                                              AS laatste_verzenddatum,
      COUNT(*)::int                                                    AS aantal_brieven,
      COUNT(*) FILTER (WHERE p.brief_status = 'verstuurd')::int        AS aantal_status_verstuurd,
      COUNT(*) FILTER (WHERE p.verzendstatus IN ('gepost','verzonden'))::int
                                                                       AS aantal_harde_verzending,
      COUNT(*) FILTER (
        WHERE p.brief_status = 'verstuurd'
          AND p.postdatum IS NULL AND p.verzonden_op IS NULL
      )::int                                                           AS aantal_zonder_verzendbewijs,
      COUNT(*) FILTER (WHERE p.heeft_actieve_taak)::int                AS aantal_met_actieve_taak,
      COUNT(*) FILTER (WHERE p.opvolgdatum IS NOT NULL)::int           AS aantal_met_opvolgdatum,
      COUNT(*) FILTER (WHERE p.responsstatus IS NOT NULL)::int         AS aantal_met_respons,
      COUNT(*) FILTER (
        WHERE p.responsstatus IN ('interesse','wil_meer_informatie','gesprek_gepland')
      )::int                                                           AS aantal_positieve_respons,
      COUNT(DISTINCT p.signaal_id) FILTER (WHERE p.is_open)::int       AS open_signalen,
      COUNT(DISTINCT p.signaal_id) FILTER (WHERE NOT p.is_open)::int   AS closed_signalen,
      COUNT(DISTINCT p.signaal_id) FILTER (
        WHERE p.signaal_status = 'in_gesprek'::public.off_market_status
      )::int                                                           AS aantal_in_gesprek_nu,
      COUNT(DISTINCT p.signaal_id) FILTER (
        WHERE p.signaal_status IN (
          'in_gesprek'::public.off_market_status,
          'aanbod_ontvangen'::public.off_market_status,
          'object_ontvangen'::public.off_market_status,
          'dealtraject'::public.off_market_status
        )
      )::int                                                           AS aantal_gespreksfase_bereikt,
      COUNT(DISTINCT p.signaal_id)::int                                AS unieke_signalen
    FROM populatie p
    GROUP BY p.campagne_stap, p.kanaal
  )
  SELECT
    a.campagne_stap,
    a.kanaal,
    a.eerste_verzenddatum,
    a.laatste_verzenddatum,
    a.aantal_brieven,
    a.aantal_status_verstuurd,
    a.aantal_harde_verzending,
    a.aantal_zonder_verzendbewijs,
    a.aantal_met_actieve_taak,
    a.aantal_met_opvolgdatum,
    a.aantal_met_respons,
    a.aantal_positieve_respons,
    ROUND(100.0 * a.aantal_met_respons::numeric  / NULLIF(a.aantal_brieven, 0), 2) AS response_coverage_pct,
    ROUND(100.0 * a.aantal_met_opvolgdatum::numeric / NULLIF(a.aantal_brieven, 0), 2) AS follow_up_coverage_pct,
    a.open_signalen,
    a.closed_signalen,
    a.aantal_in_gesprek_nu,
    a.aantal_gespreksfase_bereikt,
    ROUND(100.0 * a.aantal_gespreksfase_bereikt::numeric / NULLIF(a.unieke_signalen, 0), 2)
                                                                       AS bereikte_gespreksfase_pct,
    false                                                              AS status_history_available,
    false                                                              AS conversion_date_available,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN a.aantal_zonder_verzendbewijs > 0                                   THEN 'ontbrekend_verzendbewijs'    END,
      CASE WHEN a.aantal_met_respons < a.aantal_brieven                             THEN 'respons_dekking_onvolledig' END,
      CASE WHEN a.aantal_met_opvolgdatum < a.aantal_brieven                         THEN 'opvolging_dekking_onvolledig' END,
      CASE WHEN a.aantal_status_verstuurd <> a.aantal_harde_verzending              THEN 'status_verzendstatus_afwijking' END,
      'geen_statushistorie',
      'geen_conversiedatum',
      'respons_afwezigheid_geen_bewijs_van_geen_interesse'
    ]::text[], NULL)                                                   AS warning_codes
  FROM agg a
  ORDER BY a.campagne_stap, a.kanaal;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.7  Functie 5  —  get_off_market_ai_conversion_analysis (parameterloos, v2-contract)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis()
RETURNS TABLE (
  ai_score_bucket             text,      -- '0-24' | '25-49' | '50-74' | '75-100' | 'onbekend' | 'ongeldige_score'
  aantal                      int,
  in_gesprek                  int,
  aanbod_ontvangen            int,
  object_ontvangen            int,
  dealtraject                 int,
  afgevallen                  int,
  niet_interessant            int,
  gespreksfase_bereikt        int,       -- in_gesprek + aanbod + object + deal
  conversie_gesprek_pct       numeric,
  conversie_object_pct        numeric,
  open_signalen               int,
  closed_signalen             int,
  score_coverage_pct          numeric,   -- op alle buckets identiek: signalen met bekende geldige score / totaal
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
      s.id,
      s.status,
      s.ai_score,
      (s.gearchiveerd_op IS NULL
        AND s.status NOT IN (
          'archief'::public.off_market_status,
          'afgevallen'::public.off_market_status,
          'niet_interessant'::public.off_market_status,
          'object_ontvangen'::public.off_market_status,
          'dealtraject'::public.off_market_status
        ))                                             AS is_open,
      CASE
        WHEN s.ai_score IS NULL                    THEN 'onbekend'
        WHEN s.ai_score < 0 OR s.ai_score > 100    THEN 'ongeldige_score'
        WHEN s.ai_score BETWEEN 0  AND 24          THEN '0-24'
        WHEN s.ai_score BETWEEN 25 AND 49          THEN '25-49'
        WHEN s.ai_score BETWEEN 50 AND 74          THEN '50-74'
        ELSE                                            '75-100'
      END                                              AS bucket
    FROM public.off_market_signalen s
  ),
  totalen AS (
    SELECT
      COUNT(*)::numeric                                AS totaal,
      COUNT(*) FILTER (
        WHERE bucket IN ('0-24','25-49','50-74','75-100')
      )::numeric                                       AS met_score,
      COUNT(*) FILTER (WHERE is_open)::numeric        AS open_totaal,
      COUNT(*) FILTER (WHERE NOT is_open)::numeric    AS closed_totaal
    FROM gebucketed
  ),
  respons_stat AS (
    SELECT
      COUNT(*)::numeric                                AS totaal_brieven,
      COUNT(*) FILTER (WHERE responsstatus IS NOT NULL)::numeric AS met_respons,
      COUNT(*) FILTER (WHERE opvolgdatum   IS NOT NULL)::numeric AS met_opvolg
    FROM public.off_market_brieven
    WHERE status = 'verstuurd'
      AND (postdatum IS NOT NULL OR verzonden_op IS NOT NULL)
  ),
  per_bucket AS (
    SELECT
      g.bucket,
      COUNT(*)::int                                                                  AS aantal,
      COUNT(*) FILTER (WHERE g.status = 'in_gesprek'::public.off_market_status)::int       AS in_gesprek,
      COUNT(*) FILTER (WHERE g.status = 'aanbod_ontvangen'::public.off_market_status)::int AS aanbod_ontvangen,
      COUNT(*) FILTER (WHERE g.status = 'object_ontvangen'::public.off_market_status)::int AS object_ontvangen,
      COUNT(*) FILTER (WHERE g.status = 'dealtraject'::public.off_market_status)::int      AS dealtraject,
      COUNT(*) FILTER (WHERE g.status = 'afgevallen'::public.off_market_status)::int       AS afgevallen,
      COUNT(*) FILTER (WHERE g.status = 'niet_interessant'::public.off_market_status)::int AS niet_interessant,
      COUNT(*) FILTER (WHERE g.status IN (
        'in_gesprek'::public.off_market_status,
        'aanbod_ontvangen'::public.off_market_status,
        'object_ontvangen'::public.off_market_status,
        'dealtraject'::public.off_market_status
      ))::int                                                                        AS gespreksfase_bereikt,
      COUNT(*) FILTER (WHERE g.is_open)::int                                         AS open_signalen,
      COUNT(*) FILTER (WHERE NOT g.is_open)::int                                     AS closed_signalen
    FROM gebucketed g
    GROUP BY g.bucket
  )
  SELECT
    pb.bucket                                                                        AS ai_score_bucket,
    pb.aantal,
    pb.in_gesprek,
    pb.aanbod_ontvangen,
    pb.object_ontvangen,
    pb.dealtraject,
    pb.afgevallen,
    pb.niet_interessant,
    pb.gespreksfase_bereikt,
    ROUND(100.0 * pb.gespreksfase_bereikt::numeric / NULLIF(pb.aantal, 0), 2)        AS conversie_gesprek_pct,
    ROUND(100.0 * (pb.object_ontvangen + pb.dealtraject)::numeric / NULLIF(pb.aantal, 0), 2)
                                                                                     AS conversie_object_pct,
    pb.open_signalen,
    pb.closed_signalen,
    ROUND(100.0 * t.met_score      / NULLIF(t.totaal, 0), 2)                        AS score_coverage_pct,
    ROUND(100.0 * t.open_totaal    / NULLIF(t.totaal, 0), 2)                        AS open_population_pct,
    ROUND(100.0 * t.closed_totaal  / NULLIF(t.totaal, 0), 2)                        AS closed_population_pct,
    ROUND(100.0 * r.met_respons    / NULLIF(r.totaal_brieven, 0), 2)                AS response_coverage_pct,
    ROUND(100.0 * r.met_opvolg     / NULLIF(r.totaal_brieven, 0), 2)                AS follow_up_coverage_pct,
    false                                                                            AS status_history_available,
    false                                                                            AS conversion_date_available,
    ARRAY_REMOVE(ARRAY[
      'geen_statushistorie',
      'geen_conversiedatum',
      'respons_afwezigheid_geen_bewijs_van_geen_interesse',
      CASE WHEN pb.bucket = 'onbekend'         THEN 'signalen_zonder_ai_score'  END,
      CASE WHEN pb.bucket = 'ongeldige_score'  THEN 'ongeldige_ai_score_waarden' END
    ]::text[], NULL)                                                                 AS warning_codes
  FROM per_bucket pb
  CROSS JOIN totalen      t
  CROSS JOIN respons_stat r
  ORDER BY
    CASE pb.bucket
      WHEN '0-24'            THEN 1
      WHEN '25-49'           THEN 2
      WHEN '50-74'           THEN 3
      WHEN '75-100'          THEN 4
      WHEN 'onbekend'        THEN 5
      WHEN 'ongeldige_score' THEN 6
    END;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis() TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.8  In-transactie tests. Iedere assertion FALSE ⇒ ROLLBACK.
-- ---------------------------------------------------------------------------
DO $tests$
DECLARE
  n_funcs      int;
  n_execs      int;
  n_bad_grants int;
  n_secdef     int;
  n_owner_ok   int;
  n_searchpath int;
  n_rows       int;
BEGIN
  -- (a) Vijf functies aanwezig
  SELECT COUNT(*) INTO n_funcs
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly';
  IF n_funcs <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: verwacht 5 functies, gevonden %', n_funcs;
  END IF;

  -- (b) Reader heeft EXECUTE op alle vijf
  SELECT COUNT(*) INTO n_execs
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly'
    AND has_function_privilege('ai_gateway_reader', p.oid, 'EXECUTE');
  IF n_execs <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test: reader heeft EXECUTE op %/5', n_execs;
  END IF;

  -- (c) PUBLIC heeft nergens EXECUTE
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

  -- (f) proconfig bevat exact search_path=pg_catalog (en niets meer)
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

  -- (i) Smoke als reader (tijdelijke role-switch, geen LOGIN nodig)
  SET LOCAL ROLE ai_gateway_reader;

  SELECT COUNT(*) INTO n_rows
  FROM ai_gateway_readonly.search_off_market_signals(NULL,NULL,NULL,NULL,NULL,NULL,true,5,0);
  IF n_rows IS NULL THEN
    RAISE EXCEPTION 'BUILD-3 test: reader kan search-functie niet aanroepen';
  END IF;

  SELECT COUNT(*) INTO n_rows
  FROM ai_gateway_readonly.get_off_market_ai_conversion_analysis();
  IF n_rows IS NULL OR n_rows = 0 THEN
    RAISE EXCEPTION 'BUILD-3 test: reader krijgt geen resultaat uit conversie-analyse';
  END IF;

  RESET ROLE;
END
$tests$;

COMMIT;
```

`SET LOCAL ROLE` beperkt de role-switch tot deze transactie; `RESET ROLE` herstelt `postgres`. Geen credential of LOGIN-attribuut wordt aangemaakt.

---

## 3. Rechtenmatrix (definitief)

| Object | `ai_gateway_reader` | `PUBLIC` | `authenticated` / `anon` / `service_role` |
|---|---|---|---|
| `SCHEMA ai_gateway_readonly` | `USAGE` | geen (niet expliciet toegekend) | geen |
| `search_off_market_signals(...)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_signal(uuid)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_follow_up_queue(...)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_batch_performance(int)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_ai_conversion_analysis()` | `EXECUTE` | geen (REVOKE ALL) | geen |
| Bestaande `SCHEMA public` en bestaande objecten | ongewijzigd | ongewijzigd | ongewijzigd |

Reader krijgt geen tabel-, kolom- of `public`-schema-grants. Bestaande `PUBLIC`-schema-rechten worden niet aangepast (bestaande PUBLIC-erving blijft zoals hij is; dat valt buiten deze migratie).

---

## 4. Privilege-matrix vs. functiebody's (statische verificatie)

| Functie | Gelezen `public.*` objecten & kolommen | Reader-rechten die dit vereist |
|---|---|---|
| `search_off_market_signals` | `off_market_signalen(id, plaats, provincie, assettype, status, prioriteit, ai_score, gearchiveerd_op, search_tsv, created_at)` | `EXECUTE` op functie |
| `get_off_market_signal` | `off_market_signalen(id, titel, plaats, provincie, regio, assettype, status, prioriteit, eigenaarstatus, ai_score, ai_score_componenten, ai_samenvatting, ai_aanbevolen_actie, potentiele_strategie, volgende_actie_datum, volgende_actie_omschrijving, created_at, updated_at)`; `taken(off_market_signaal_id, status, soft_deleted_at)`; `contact_moments(off_market_signaal_id)`; `off_market_brieven(signaal_id, status, kanaal, campagne_stap, postdatum, verzonden_op, responsstatus)` | `EXECUTE` op functie |
| `get_off_market_follow_up_queue` | `off_market_signalen(id, plaats, provincie, assettype, status, ai_score, gearchiveerd_op, volgende_actie_datum)`; `taken(id, off_market_signaal_id, status, soft_deleted_at)`; `contact_moments(off_market_signaal_id, moment_date)`; `off_market_brieven(signaal_id, status, postdatum, verzonden_op, opvolgdatum, gekoppelde_taak_id)` | `EXECUTE` op functie |
| `get_off_market_batch_performance` | `off_market_brieven(id, signaal_id, campagne_stap, kanaal, postdatum, verzonden_op, status, verzendstatus, opvolgdatum, gekoppelde_taak_id, responsstatus)`; `off_market_signalen(id, status, gearchiveerd_op)`; `taken(id, status, soft_deleted_at)` | `EXECUTE` op functie |
| `get_off_market_ai_conversion_analysis` | `off_market_signalen(id, status, ai_score, gearchiveerd_op)`; `off_market_brieven(status, postdatum, verzonden_op, responsstatus, opvolgdatum)` | `EXECUTE` op functie |

Geen functie refereert aan `off_market_brief_events`, `off_market_signalen_ruw`, `off_market_ai_runs`, `off_market_kadaster_checks`, `kadaster_data_records`, `kadaster_documenten`, `relaties`, `relatie_contactpersonen`, `profiles`, `deals`, `objecten`, `contact_moments.description`, `contact_moments.outcome`, `contact_moments.title`, `taken.titel`, `off_market_signalen.notities`, `off_market_signalen.omschrijving`, `off_market_signalen.archief_reden`, `off_market_signalen.eigenaar_*`, `off_market_signalen.postcode`, `off_market_signalen.indicatieve_waarde` of `off_market_signalen.mogelijke_fee`.

---

## 5. Atomair test- en rollbackgedrag

- Eén transactie `BEGIN; ... COMMIT;`. DDL is transactioneel in Postgres.
- Alle assertions in de `DO $tests$`-block gebruiken `RAISE EXCEPTION` → transactie rolt automatisch terug voordat `COMMIT` wordt bereikt.
- Role-switch via `SET LOCAL ROLE ai_gateway_reader` is scoped tot deze transactie, vereist geen `LOGIN`-attribuut en levert geen credential op. `RESET ROLE` herstelt de outer role (`postgres`) voordat `COMMIT` volgt.
- Bij falen: geen schema, geen role, geen functies, geen grants blijven achter — de outer transactie faalt en de database blijft in pre-migratietoestand.
- End-to-end validatie via pooler + JWT (echte LOGIN) hoort in BUILD-3B en zit expliciet niet in deze migratie.

---

## 6. Volledige rollback (afzonderlijke transactie, alleen na apart akkoord)

```sql
BEGIN;

-- 6.1 Rechten intrekken (redundant t.o.v. DROP, maar expliciet).
REVOKE EXECUTE ON FUNCTION ai_gateway_readonly.search_off_market_signals(
  text, text, text,
  public.off_market_assettype,
  public.off_market_status[],
  int, boolean, int, int
) FROM ai_gateway_reader;

REVOKE EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_signal(uuid)
  FROM ai_gateway_reader;

REVOKE EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_follow_up_queue(
  text, public.off_market_assettype, int
) FROM ai_gateway_reader;

REVOKE EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int)
  FROM ai_gateway_reader;

REVOKE EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis()
  FROM ai_gateway_reader;

REVOKE USAGE ON SCHEMA ai_gateway_readonly FROM ai_gateway_reader;

-- 6.2 Functies droppen (exact zoals aangemaakt).
DROP FUNCTION IF EXISTS ai_gateway_readonly.search_off_market_signals(
  text, text, text,
  public.off_market_assettype,
  public.off_market_status[],
  int, boolean, int, int
);
DROP FUNCTION IF EXISTS ai_gateway_readonly.get_off_market_signal(uuid);
DROP FUNCTION IF EXISTS ai_gateway_readonly.get_off_market_follow_up_queue(
  text, public.off_market_assettype, int
);
DROP FUNCTION IF EXISTS ai_gateway_readonly.get_off_market_batch_performance(int);
DROP FUNCTION IF EXISTS ai_gateway_readonly.get_off_market_ai_conversion_analysis();

-- 6.3 Schema en role opruimen.
DROP SCHEMA IF EXISTS ai_gateway_readonly;
DROP ROLE   IF EXISTS ai_gateway_reader;

COMMIT;
```

Rollback bevat **geen** `ALTER DEFAULT PRIVILEGES`, **geen** `GRANT ... TO PUBLIC`, **geen** wijziging aan bestaande CRM-objecten of RLS-policies.

---

## 7. Statische bevestiging uitgesloten velden en constructies

| Uitgesloten / verboden | Aanwezig in DDL? |
|---|---|
| `indicatieve_waarde` | Nee |
| `mogelijke_fee` | Nee |
| Eigenaar-PII (naam, e-mail, telefoon, KVK, LinkedIn) | Nee |
| Postcode / straat / huisnummer | Nee |
| `off_market_brief_events` | Nee |
| `off_market_signalen_ruw` | Nee |
| `off_market_ai_runs` | Nee |
| `off_market_kadaster_checks` | Nee |
| `kadaster_data_records` / `kadaster_documenten` | Nee |
| Vrije contactmomenttekst (`description`, `outcome`, `title`) | Nee |
| `titel` in searchtool of follow-upqueue | Nee — beide gebruiken `display_label`; `search_tsv` alleen intern voor `p_query` |
| `ai_samenvatting` / `potentiele_strategie` in searchtool | Nee — alleen in detailtool (P3) |
| `ALTER DEFAULT PRIVILEGES` | Nee (niet in migratie, niet in rollback) |
| `GRANT ... TO PUBLIC` | Nee |
| `BYPASSRLS`-toekenning | Nee |
| `service_role`-referentie | Nee |
| RLS-policywijziging | Nee |
| Wijziging bestaande PUBLIC-schema-grants | Nee |
| `pg_temp` in search_path | Nee — search_path is exclusief `pg_catalog` |
| `public` in search_path | Nee |
| `SELECT *` binnen functiebody's | Nee — alle kolommen expliciet |
| `pg_catalog.current_date` | Nee — vervangen door `CURRENT_DATE` |
| Respons-afwezigheid gebruikt als bewijs van geen interesse | Nee — expliciet gedocumenteerd via `warning_codes` (`respons_afwezigheid_geen_bewijs_van_geen_interesse`) |
| `int`-signature op functie 5 | Nee — parameterloos |
| `SELECT s.*` in follow-upfunctie | Nee — expliciete kolommen |
| Assertion "reader mag geen USAGE op public" | Nee — verwijderd (PUBLIC-erving mag bestaan) |
| Recordlimiet zonder ondergrens | Nee — alle limieten geclampt op 1–100 |

Follow-up-regels bevestigd:
- `brief_zonder_opvolging`: `status='verstuurd'` + `(postdatum IS NOT NULL OR verzonden_op IS NOT NULL)` + `opvolgdatum IS NULL` + geen actieve gekoppelde taak (join op `taken` met status `open`/`in_uitvoering`/`wacht_op_reactie`).
- `brief_opvolgdatum_verstreken`: `status='verstuurd'` + betrouwbaar verzendbewijs + `opvolgdatum < CURRENT_DATE`.
- `actie_datum_verstreken`: `volgende_actie_datum IS NOT NULL AND volgende_actie_datum < CURRENT_DATE`.
- `geen_actieve_taak`: `aantal_actieve_taken = 0`.
- `zonder_actie_datum`: `volgende_actie_datum IS NULL`.

Actieve taakstatussen door alle functies heen: `open`, `in_uitvoering`, `wacht_op_reactie`.

---

## 8. Definitief GO/NO-GO

**GO — voorwaardelijk op uitvoering exact zoals hierboven gespecificeerd.**

Uitvoering is toegestaan zodra alle onderstaande voorwaarden **allemaal** waar zijn:

1. Migratie is één transactie zoals in §2, inclusief het `DO $tests$`-block; iedere assertion-faal leidt automatisch tot `ROLLBACK`.
2. Owner van schema en vijf functies = `postgres`. Geen tweede role.
3. `ai_gateway_reader` = `NOLOGIN`, `NOBYPASSRLS`, `NOINHERIT`, zonder tabel-, kolom- of `public`-schema-grants; USAGE alleen op `ai_gateway_readonly`.
4. Enige rechten aan reader: `USAGE` op `ai_gateway_readonly` + `EXECUTE` op vijf exacte functiesignaturen.
5. `SET search_path = pg_catalog` op alle vijf functies; alle `public.*`-verwijzingen volledig gekwalificeerd; geen `pg_temp`, geen `public` in search_path.
6. Geen `ALTER DEFAULT PRIVILEGES` in migratie of rollback. Geen `GRANT ... TO PUBLIC` waar dan ook.
7. Rollback exact zoals §6.
8. Functie 5 is parameterloos in `CREATE`, `REVOKE`, `GRANT`, `DROP`, objectenlijst, tests. Geen `int`-signature.
9. Follow-upqueue met exact vijf redencodes: `brief_opvolgdatum_verstreken`, `brief_zonder_opvolging`, `actie_datum_verstreken`, `geen_actieve_taak`, `zonder_actie_datum`.
10. `off_market_brief_events` komt in geen enkele functie voor.
11. Limieten geclampt op 1–100 in alle drie functies met `p_limit`.
12. `brief_zonder_opvolging` en `brief_opvolgdatum_verstreken` vereisen betrouwbaar verzendbewijs (`postdatum IS NOT NULL OR verzonden_op IS NOT NULL`) én `status='verstuurd'`. `brief_zonder_opvolging` vereist bovendien geen actieve gekoppelde taak.
13. `warning_codes` van functies 4 en 5 bevatten expliciet `respons_afwezigheid_geen_bewijs_van_geen_interesse`, `geen_statushistorie` en `geen_conversiedatum`.
14. Reader-smoke test met `SET LOCAL ROLE ai_gateway_reader` slaagt binnen de transactie; wordt gevolgd door `RESET ROLE`.

**NO-GO** op iedere afwijking, en op iedere handeling die buiten deze migratie valt (credential-uitgifte, pooler-configuratie, gatewaycode) — die horen in afzonderlijke, apart goed te keuren stappen (BUILD-3B en verder).

---

## 9. Wijzigingen t.o.v. v2

- `pg_catalog.current_date` → `CURRENT_DATE` overal; weekvenster in functie 4 gebruikt `CURRENT_DATE - (bounded.wk * 7)`.
- Follow-upfunctie: `SELECT s.*` verwijderd; expliciete kolommen; vijf redencodes hersteld (`brief_opvolgdatum_verstreken`, `brief_zonder_opvolging`, `actie_datum_verstreken`, `geen_actieve_taak`, `zonder_actie_datum`); `heeft_actieve_taak`, `aantal_actieve_taken` uniform benoemd; `brief_zonder_opvolging` vereist ontbreken van actieve gekoppelde taak; `brief_opvolgdatum_verstreken` toegevoegd.
- Detailfunctie hernoemd `heeft_open_taak` → `heeft_actieve_taak` en `aantal_actieve_taken` toegevoegd.
- Alle `p_limit`-parameters geclampt op 1–100.
- Batchfunctie hersteld naar BUILD-2B-v2-contract incl. onderscheid harde verzending vs. `status='verstuurd'`, `aantal_zonder_verzendbewijs`, open/gesloten populatie, `aantal_in_gesprek_nu`, `aantal_gespreksfase_bereikt`, `bereikte_gespreksfase_pct`, `status_history_available=false`, `conversion_date_available=false`, `warning_codes` incl. expliciete waarschuwing dat responsafwezigheid geen bewijs van geen interesse is.
- Conversiefunctie hersteld naar BUILD-2B-v2-contract: parameterloos, `gespreksfase_bereikt`, `score_coverage_pct`, `open_population_pct`, `closed_population_pct`, `response_coverage_pct`, `follow_up_coverage_pct`, meta-vlaggen `status_history_available=false` en `conversion_date_available=false`, `warning_codes`, buckets `onbekend` en `ongeldige_score`.
- Tests: assertion "reader mag geen USAGE op public" verwijderd. Nieuwe assertions: `SECURITY DEFINER`, owner `postgres`, `proconfig = ['search_path=pg_catalog']`. Reader-smoke test met `SET LOCAL ROLE` + `RESET ROLE` binnen de transactie.

---

*Einde BUILD-3-specificatie v3. Geen SQL uitgevoerd. Geen role, schema, functie, policy, grant, credential of gatewayverbinding aangemaakt.*
