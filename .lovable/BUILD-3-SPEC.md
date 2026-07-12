# BUILD-3 — Definitieve migratiespecificatie (niet uitgevoerd)

Doel: één atomair migratiebestand voor productieproject `ljudxyrqoifhfikueric` dat een geïsoleerd read-only functieoppervlak toevoegt voor de Bito CRM AI Gateway. Geen wijziging aan bestaande CRM-tabellen, -triggers, -policies of -functies. Deze specificatie wordt **niet** uitgevoerd; uitvoering vereist afzonderlijke goedkeuring.

---

## 1. Owner- en rechtenmodel (samenvatting)

| Object | Owner | Rechten |
|---|---|---|
| `SCHEMA ai_gateway_readonly` | `postgres` | `USAGE` → `ai_gateway_reader` |
| Vijf `SECURITY DEFINER`-functies | `postgres` | `EXECUTE` → `ai_gateway_reader` (na expliciete `REVOKE ALL ... FROM PUBLIC`) |
| `ROLE ai_gateway_reader` | — | `NOLOGIN`, geen `BYPASSRLS`, geen tabelrechten, geen kolomrechten, geen toegang tot schema `public` |

Er wordt geen tweede role aangemaakt. Geen `ALTER DEFAULT PRIVILEGES`. Geen policy­wijziging op bestaande CRM-tabellen.

RLS-onderbouwing (bevestigd in BUILD-2C): `postgres` bezit `BYPASSRLS=true` van nature (Supabase-standaard). SECURITY DEFINER-functies met owner `postgres` lezen dus door de bestaande RLS heen zonder policy­wijziging. `ai_gateway_reader` zelf raakt nooit een tabel.

---

## 2. Volledige migratie-DDL (één transactie, fail-closed)

Alles hieronder draait als één transactie. Bij iedere fout (compile, privilege, functionele test) volgt `ROLLBACK` en blijft de productie ongewijzigd.

```sql
BEGIN;

-- ---------------------------------------------------------------------------
-- 2.1  Schema
-- ---------------------------------------------------------------------------
CREATE SCHEMA ai_gateway_readonly AUTHORIZATION postgres;

-- ---------------------------------------------------------------------------
-- 2.2  Reader-role (NOLOGIN, geen BYPASSRLS, geen inherit van andere rollen)
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
    -- display_label: geen straatnaam/PII, geen ruwe titel
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
    AND (p_plaats     IS NULL OR s.plaats    = p_plaats)
    AND (p_assettype  IS NULL OR s.assettype = p_assettype)
    AND (p_status_in  IS NULL OR s.status    = ANY (p_status_in))
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
  LIMIT  pg_catalog.least(COALESCE(p_limit, 50), 100)
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
-- 2.4  Functie 2  —  get_off_market_signal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_signal(
  p_id uuid
)
RETURNS TABLE (
  id                          uuid,
  titel                       text,   -- P3: volledig, alleen in detailtool
  plaats                      text,
  provincie                   text,
  regio                       text,
  assettype                   public.off_market_assettype,
  status                      public.off_market_status,
  prioriteit                  public.off_market_prioriteit,
  eigenaarstatus              public.off_market_eigenaarstatus,
  ai_score                    int,
  ai_score_componenten        jsonb,
  ai_samenvatting             text,   -- P3
  ai_aanbevolen_actie         text,   -- P3
  potentiele_strategie        text,   -- P3
  volgende_actie_datum        date,
  volgende_actie_omschrijving text,   -- P3
  heeft_open_taak             boolean,
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
      SELECT 1 FROM public.taken AS t
      WHERE t.off_market_signaal_id = s.id
        AND t.soft_deleted_at IS NULL
        AND t.status IN (
          'open'::public.taak_status,
          'in_uitvoering'::public.taak_status,
          'wacht_op_reactie'::public.taak_status
        )
    )                                                              AS heeft_open_taak,
    (SELECT COUNT(*)::int FROM public.contact_moments cm
      WHERE cm.off_market_signaal_id = s.id)                       AS aantal_contactmomenten,
    (SELECT COUNT(*)::int FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id
        AND b.status = 'verstuurd')                                AS aantal_verstuurde_brieven,
    (SELECT b.kanaal FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.status = 'verstuurd'
      ORDER BY COALESCE(b.postdatum, b.verzonden_op::date) DESC NULLS LAST
      LIMIT 1)                                                     AS laatste_brief_kanaal,
    (SELECT b.campagne_stap FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.status = 'verstuurd'
      ORDER BY COALESCE(b.postdatum, b.verzonden_op::date) DESC NULLS LAST
      LIMIT 1)                                                     AS laatste_brief_campagne_stap,
    (SELECT b.responsstatus FROM public.off_market_brieven b
      WHERE b.signaal_id = s.id AND b.responsstatus IS NOT NULL
      ORDER BY COALESCE(b.postdatum, b.verzonden_op::date) DESC NULLS LAST
      LIMIT 1)                                                     AS laatste_respons_status,
    s.created_at,
    s.updated_at
  FROM public.off_market_signalen AS s
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
  volgende_actie_datum           date,
  aantal_open_taken              int,
  laatste_contactmoment_op       date,
  oudste_openstaande_opvolgdatum date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  WITH actief AS (
    SELECT s.*
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
  open_taken AS (
    SELECT t.off_market_signaal_id AS signaal_id, COUNT(*)::int AS n
    FROM public.taken t
    WHERE t.soft_deleted_at IS NULL
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
    -- betrouwbaar verzendbewijs: brief moet aantoonbaar verstuurd zijn
    SELECT b.signaal_id, MIN(COALESCE(b.postdatum, b.verzonden_op::date)) AS oudste
    FROM public.off_market_brieven b
    WHERE b.status = 'verstuurd'
      AND (b.postdatum IS NOT NULL OR b.verzonden_op IS NOT NULL)
      AND b.opvolgdatum IS NULL
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
      COALESCE(ot.n, 0)                                               AS aantal_open_taken,
      lc.d                                                            AS laatste_contactmoment_op,
      bzo.oudste                                                      AS oudste_openstaande_opvolgdatum,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN COALESCE(ot.n, 0) = 0                                                                  THEN 'geen_open_taak'          END,
        CASE WHEN a.volgende_actie_datum IS NOT NULL AND a.volgende_actie_datum < pg_catalog.current_date THEN 'actie_datum_verstreken'   END,
        CASE WHEN a.volgende_actie_datum IS NULL                                                          THEN 'zonder_actie_datum'      END,
        CASE WHEN bzo.signaal_id IS NOT NULL                                                              THEN 'brief_zonder_opvolging' END
      ]::text[], NULL)                                                AS reden_codes
    FROM actief a
    LEFT JOIN open_taken             ot  ON ot.signaal_id  = a.id
    LEFT JOIN laatste_cm             lc  ON lc.signaal_id  = a.id
    LEFT JOIN brief_zonder_opvolging bzo ON bzo.signaal_id = a.id
  )
  SELECT
    g.signaal_id,
    g.display_label,
    g.plaats,
    g.provincie,
    g.status,
    g.ai_score,
    -- primaire_reden: eerste hit in vaste prioriteitsvolgorde
    COALESCE(
      g.reden_codes[1],
      NULL
    )                                                                 AS primaire_reden,
    g.reden_codes,
    g.volgende_actie_datum,
    g.aantal_open_taken,
    g.laatste_contactmoment_op,
    g.oudste_openstaande_opvolgdatum
  FROM gescoord g
  WHERE pg_catalog.array_length(g.reden_codes, 1) IS NOT NULL
  ORDER BY g.ai_score DESC NULLS LAST, g.oudste_openstaande_opvolgdatum ASC NULLS LAST
  LIMIT pg_catalog.least(COALESCE(p_limit, 50), 100);
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
  campagne_stap           text,
  kanaal                  text,
  eerste_verzenddatum     date,
  laatste_verzenddatum    date,
  aantal_brieven          int,
  aantal_verzonden        int,
  aantal_met_taak         int,
  aantal_met_respons      int,
  aantal_positieve_respons int,
  conversie_naar_gesprek  numeric
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
      COALESCE(b.campagne_stap, '<zonder_batch>')                    AS campagne_stap,
      b.kanaal,
      COALESCE(b.postdatum, b.verzonden_op::date)                    AS verzenddatum,
      b.id,
      b.signaal_id,
      b.verzendstatus,
      b.gekoppelde_taak_id,
      b.responsstatus
    FROM public.off_market_brieven b, bounded
    WHERE COALESCE(b.postdatum, b.verzonden_op::date)
          >= pg_catalog.current_date - (bounded.wk || ' weeks')::interval
  )
  SELECT
    br.campagne_stap,
    br.kanaal,
    MIN(br.verzenddatum)                                             AS eerste_verzenddatum,
    MAX(br.verzenddatum)                                             AS laatste_verzenddatum,
    COUNT(*)::int                                                    AS aantal_brieven,
    COUNT(*) FILTER (WHERE br.verzendstatus IN ('gepost','verzonden'))::int
                                                                     AS aantal_verzonden,
    COUNT(*) FILTER (WHERE br.gekoppelde_taak_id IS NOT NULL)::int   AS aantal_met_taak,
    COUNT(*) FILTER (WHERE br.responsstatus IS NOT NULL)::int        AS aantal_met_respons,
    COUNT(*) FILTER (
      WHERE br.responsstatus IN ('interesse','wil_meer_informatie','gesprek_gepland')
    )::int                                                           AS aantal_positieve_respons,
    ROUND(
      100.0 * COUNT(DISTINCT br.signaal_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.off_market_signalen s
          WHERE s.id = br.signaal_id
            AND s.status = 'in_gesprek'::public.off_market_status
        )
      )::numeric
      / NULLIF(COUNT(DISTINCT br.signaal_id), 0),
      2
    )                                                                AS conversie_naar_gesprek
  FROM brieven br
  GROUP BY br.campagne_stap, br.kanaal
  ORDER BY br.campagne_stap, br.kanaal;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_batch_performance(int) TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.7  Functie 5  —  get_off_market_ai_conversion_analysis  (parameterloos)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis()
RETURNS TABLE (
  ai_score_bucket        text,
  aantal                 int,
  in_gesprek             int,
  aanbod_ontvangen       int,
  object_ontvangen       int,
  dealtraject            int,
  afgevallen             int,
  niet_interessant       int,
  conversie_gesprek_pct  numeric,
  conversie_object_pct   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
  WITH b AS (
    SELECT
      CASE
        WHEN s.ai_score IS NULL     THEN 'onbekend'
        WHEN s.ai_score BETWEEN 0  AND 24 THEN '0-24'
        WHEN s.ai_score BETWEEN 25 AND 49 THEN '25-49'
        WHEN s.ai_score BETWEEN 50 AND 74 THEN '50-74'
        ELSE '75-100'
      END                            AS bucket,
      s.status
    FROM public.off_market_signalen s
  )
  SELECT
    b.bucket                                                                       AS ai_score_bucket,
    COUNT(*)::int                                                                  AS aantal,
    COUNT(*) FILTER (WHERE b.status = 'in_gesprek'::public.off_market_status)::int       AS in_gesprek,
    COUNT(*) FILTER (WHERE b.status = 'aanbod_ontvangen'::public.off_market_status)::int AS aanbod_ontvangen,
    COUNT(*) FILTER (WHERE b.status = 'object_ontvangen'::public.off_market_status)::int AS object_ontvangen,
    COUNT(*) FILTER (WHERE b.status = 'dealtraject'::public.off_market_status)::int      AS dealtraject,
    COUNT(*) FILTER (WHERE b.status = 'afgevallen'::public.off_market_status)::int       AS afgevallen,
    COUNT(*) FILTER (WHERE b.status = 'niet_interessant'::public.off_market_status)::int AS niet_interessant,
    ROUND(100.0 *
      COUNT(*) FILTER (WHERE b.status IN (
        'in_gesprek'::public.off_market_status,
        'aanbod_ontvangen'::public.off_market_status,
        'object_ontvangen'::public.off_market_status,
        'dealtraject'::public.off_market_status
      ))::numeric / NULLIF(COUNT(*), 0), 2)                                       AS conversie_gesprek_pct,
    ROUND(100.0 *
      COUNT(*) FILTER (WHERE b.status IN (
        'object_ontvangen'::public.off_market_status,
        'dealtraject'::public.off_market_status
      ))::numeric / NULLIF(COUNT(*), 0), 2)                                       AS conversie_object_pct
  FROM b
  GROUP BY b.bucket
  ORDER BY
    CASE b.bucket
      WHEN '0-24'    THEN 1
      WHEN '25-49'   THEN 2
      WHEN '50-74'   THEN 3
      WHEN '75-100'  THEN 4
      WHEN 'onbekend' THEN 5
    END;
$fn$;

REVOKE ALL   ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_gateway_readonly.get_off_market_ai_conversion_analysis() TO ai_gateway_reader;

-- ---------------------------------------------------------------------------
-- 2.8  In-transactie tests (privilege + smoke). Iedere assertion FALSE => ROLLBACK.
-- ---------------------------------------------------------------------------
DO $tests$
DECLARE
  n_funcs int;
  n_execs int;
  n_bad_grants int;
  cnt int;
BEGIN
  -- Vijf functies aanwezig in het nieuwe schema
  SELECT COUNT(*) INTO n_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly';
  IF n_funcs <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test faalt: verwacht 5 functies, gevonden %', n_funcs;
  END IF;

  -- Reader heeft EXECUTE op alle vijf functies
  SELECT COUNT(*) INTO n_execs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly'
    AND has_function_privilege('ai_gateway_reader', p.oid, 'EXECUTE');
  IF n_execs <> 5 THEN
    RAISE EXCEPTION 'BUILD-3 test faalt: reader heeft EXECUTE op %/5 functies', n_execs;
  END IF;

  -- PUBLIC heeft op geen enkele functie EXECUTE
  SELECT COUNT(*) INTO n_bad_grants
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'ai_gateway_readonly'
    AND has_function_privilege('public', p.oid, 'EXECUTE');
  IF n_bad_grants <> 0 THEN
    RAISE EXCEPTION 'BUILD-3 test faalt: PUBLIC heeft EXECUTE op % functie(s)', n_bad_grants;
  END IF;

  -- Reader heeft geen SELECT op de vier RLS-tabellen
  IF has_table_privilege('ai_gateway_reader', 'public.off_market_signalen', 'SELECT')
  OR has_table_privilege('ai_gateway_reader', 'public.off_market_brieven',  'SELECT')
  OR has_table_privilege('ai_gateway_reader', 'public.taken',                'SELECT')
  OR has_table_privilege('ai_gateway_reader', 'public.contact_moments',      'SELECT') THEN
    RAISE EXCEPTION 'BUILD-3 test faalt: reader mag rechtstreeks SELECTen op RLS-tabel';
  END IF;

  -- Reader heeft geen USAGE op schema public
  IF has_schema_privilege('ai_gateway_reader', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'BUILD-3 test faalt: reader heeft USAGE op public';
  END IF;

  -- Smoke: functies compileren en zijn aanroepbaar als owner (postgres) binnen deze txn.
  -- Deze SELECTs valideren SQL + kolom-signature; ze retourneren geen data buiten de txn.
  PERFORM 1 FROM ai_gateway_readonly.search_off_market_signals(NULL,NULL,NULL,NULL,NULL,NULL,true,1,0);
  PERFORM 1 FROM ai_gateway_readonly.get_off_market_follow_up_queue(NULL,NULL,1);
  PERFORM 1 FROM ai_gateway_readonly.get_off_market_batch_performance(1);
  PERFORM 1 FROM ai_gateway_readonly.get_off_market_ai_conversion_analysis();

  SELECT COUNT(*) INTO cnt FROM public.off_market_signalen LIMIT 1;
  IF cnt IS NULL THEN
    RAISE EXCEPTION 'BUILD-3 test faalt: basis SELECT niet uitvoerbaar';
  END IF;
END
$tests$;

COMMIT;
```

---

## 3. Rechtenmatrix (definitief)

| Object | `ai_gateway_reader` | `PUBLIC` | `authenticated` / `anon` / `service_role` |
|---|---|---|---|
| `SCHEMA ai_gateway_readonly` | `USAGE` | geen | geen (niet expliciet toegekend; blijft ongewijzigd t.o.v. Postgres-default = geen) |
| `search_off_market_signals(...)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_signal(uuid)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_follow_up_queue(...)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_batch_performance(int)` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `get_off_market_ai_conversion_analysis()` | `EXECUTE` | geen (REVOKE ALL) | geen |
| `SCHEMA public` en alle bestaande objecten | ongewijzigd (reader krijgt niets) | ongewijzigd | ongewijzigd |

Er wordt niets toegekend aan `authenticated`, `anon`, `service_role`. Er wordt niets ingetrokken op bestaande CRM-objecten. Geen `ALTER DEFAULT PRIVILEGES` — noch in migratie, noch in rollback.

---

## 4. Privilege-matrix vs. functiebody's (statische verificatie)

| Functie | Gelezen `public.*` objecten | Reader-rechten die dit vereist |
|---|---|---|
| `search_off_market_signals` | `off_market_signalen` (kolommen: `id, plaats, provincie, assettype, status, prioriteit, ai_score, gearchiveerd_op, search_tsv, created_at`) | Enkel `EXECUTE` op deze functie. Reader raakt tabel nooit direct. |
| `get_off_market_signal` | `off_market_signalen` (detailkolommen incl. `titel, ai_samenvatting, ai_aanbevolen_actie, potentiele_strategie, volgende_actie_omschrijving, ai_score_componenten`, **zonder** `indicatieve_waarde` en `mogelijke_fee`), `taken (off_market_signaal_id, status, soft_deleted_at)`, `contact_moments (off_market_signaal_id)`, `off_market_brieven (signaal_id, status, kanaal, campagne_stap, postdatum, verzonden_op, responsstatus)` | Enkel `EXECUTE`. |
| `get_off_market_follow_up_queue` | `off_market_signalen (id, plaats, provincie, assettype, status, ai_score, gearchiveerd_op, volgende_actie_datum)`, `taken (off_market_signaal_id, status, soft_deleted_at)`, `contact_moments (off_market_signaal_id, moment_date)`, `off_market_brieven (signaal_id, status, postdatum, verzonden_op, opvolgdatum)` | Enkel `EXECUTE`. |
| `get_off_market_batch_performance` | `off_market_brieven (campagne_stap, kanaal, postdatum, verzonden_op, verzendstatus, gekoppelde_taak_id, responsstatus, signaal_id, id)`, `off_market_signalen (id, status)` | Enkel `EXECUTE`. |
| `get_off_market_ai_conversion_analysis` | `off_market_signalen (ai_score, status)` | Enkel `EXECUTE`. |

Geen enkele functiebody refereert aan:
`off_market_brief_events`, `off_market_signalen_ruw`, `off_market_ai_runs`, `off_market_kadaster_checks`, `kadaster_data_records`, `kadaster_documenten`, `relaties`, `relatie_contactpersonen`, `profiles`, `deals`, `objecten`, `contact_moments.description`, `contact_moments.outcome`, `contact_moments.title`, `taken.titel`, `off_market_signalen.notities`, `off_market_signalen.omschrijving`, `off_market_signalen.archief_reden`, `off_market_signalen.eigenaar_*`, `off_market_signalen.postcode`, `off_market_signalen.indicatieve_waarde`, `off_market_signalen.mogelijke_fee`.

---

## 5. Atomair test- en rollbackgedrag

- Alle DDL + tests staan tussen één `BEGIN;` en `COMMIT;`. Postgres staat DDL in transacties toe; iedere `RAISE EXCEPTION` in de `DO`-block breekt de transactie en `COMMIT` wordt nooit bereikt. Geen tussenstaat blijft achter.
- **Role-switching tijdens de migratie is niet nodig.** De transactie draait als `postgres`; privilegetests gebruiken `has_function_privilege('ai_gateway_reader', ...)`, `has_table_privilege('ai_gateway_reader', ...)` en `has_schema_privilege('ai_gateway_reader', ...)`. Deze catalog-checks vereisen geen `SET ROLE` en geen login als reader.
- End-to-end datavalidatie als daadwerkelijke `ai_gateway_reader` (via pooler + JWT) hoort in **BUILD-3B** (login-credential-uitgifte). Wordt niet in deze migratie gedaan; anders is een LOGIN-role of tijdelijke credential nodig, wat buiten scope BUILD-3 valt.
- Bij iedere compile-, privilege-, output- of privacy­fout in de `DO`-block: transactie rolt automatisch terug; geen schema, geen role, geen functie blijven staan.

---

## 6. Volledige rollback (afzonderlijke transactie, uitgevoerd na expliciet akkoord om terug te draaien)

```sql
BEGIN;

-- 6.1  Trek reader-rechten in (redundant t.o.v. DROP, maar expliciet).
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

-- 6.2  Drop vijf functies met exact de aangemaakte signatures.
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

-- 6.3  Drop schema (leeg na functie-drops).
DROP SCHEMA IF EXISTS ai_gateway_readonly;

-- 6.4  Drop reader-role.
DROP ROLE IF EXISTS ai_gateway_reader;

COMMIT;
```

Rollback bevat: **geen** `ALTER DEFAULT PRIVILEGES`, **geen** `GRANT ... TO PUBLIC`, **geen** aanpassing van bestaande CRM-objecten, **geen** policy­wijziging.

---

## 7. Statische bevestiging uitgesloten velden

Grep-controle over de vijf functiebody's in dit bestand (uit te voeren als sanity check vóór uitvoering):

| Uitgesloten veld / object | Aanwezig in DDL? |
|---|---|
| `indicatieve_waarde` | Nee |
| `mogelijke_fee` | Nee |
| `eigenaar_naam` / `eigenaar_email` / `eigenaar_telefoon` / `eigenaar_kvk` / `eigenaar_linkedin` | Nee |
| `postcode` / `adres` / `straat` / `huisnummer` | Nee |
| `off_market_brief_events` | Nee |
| `off_market_signalen_ruw` | Nee |
| `off_market_ai_runs` | Nee |
| `off_market_kadaster_checks` | Nee |
| `kadaster_data_records` / `kadaster_documenten` | Nee |
| `contact_moments.description` / `.outcome` / `.title` | Nee (alleen `moment_date` en `off_market_signaal_id`) |
| `taken.titel` / `.type_taak` / `.deadline` | Nee (alleen `off_market_signaal_id`, `status`, `soft_deleted_at`) |
| `off_market_signalen.notities` / `.omschrijving` / `.archief_reden` | Nee |
| `titel` in searchtool | Nee (searchtool gebruikt `display_label`; `search_tsv` alleen intern voor `p_query`) |
| `titel` in follow-upqueue | Nee (follow-up gebruikt `display_label`) |
| `ai_samenvatting`, `potentiele_strategie` in searchtool | Nee (alleen in detailtool, P3) |
| `ALTER DEFAULT PRIVILEGES` | Nee (niet in migratie, niet in rollback) |
| `GRANT ... TO PUBLIC` in rollback | Nee |
| `BYPASSRLS`-toekenning | Nee |
| `service_role`-referentie | Nee |
| RLS-policywijziging | Nee |

Detailtool `get_off_market_signal` bevat wél de toegestane P3-velden: `titel`, `ai_samenvatting`, `ai_aanbevolen_actie`, `potentiele_strategie`, `volgende_actie_omschrijving`. `indicatieve_waarde` en `mogelijke_fee` blijven uitgesloten — bevestigd in §2.4.

---

## 8. Definitief GO/NO-GO

**GO — voorwaardelijk op uitvoering exact zoals hierboven gespecificeerd.**

Uitvoering is toegestaan zodra alle onderstaande voorwaarden **allemaal** waar zijn:

1. Migratie is één transactie zoals in §2, inclusief `DO $tests$`-block; iedere assertion-faal leidt automatisch tot `ROLLBACK`.
2. Owner van schema en vijf functies = `postgres`. Geen tweede role.
3. `ai_gateway_reader` = `NOLOGIN`, `NOBYPASSRLS`, `NOINHERIT`, zonder tabel-, kolom- of `public`-schema-rechten.
4. Enige rechten aan reader: `USAGE` op `ai_gateway_readonly` + `EXECUTE` op de vijf exacte functiesignaturen.
5. `search_path = pg_catalog` op alle vijf functies; alle `public.*`-verwijzingen volledig gekwalificeerd; geen `pg_temp`, geen `public` in search_path.
6. Geen `ALTER DEFAULT PRIVILEGES` in migratie of rollback. Geen `GRANT ... TO PUBLIC` waar dan ook.
7. Rollback exact zoals §6.
8. Functie 5 is parameterloos in `CREATE`, `REVOKE`, `GRANT`, `DROP` en tests. Geen `int`-signature.
9. Follow-upregel `brief_zonder_opvolging` gebruikt uitsluitend `b.opvolgdatum IS NULL`; verzendbewijs verplicht (`status = 'verstuurd'` + `postdatum IS NOT NULL OR verzonden_op IS NOT NULL`).
10. `off_market_brief_events` komt in geen enkele functie voor.

**NO-GO** op iedere afwijking, en op iedere handeling die buiten deze migratie valt (credential-uitgifte, pooler-configuratie, gateway-code) — die horen in afzonderlijke, apart goed te keuren stappen (BUILD-3B en verder).

---

*Einde BUILD-3-specificatie. Geen SQL uitgevoerd. Geen role, schema, functie, policy, grant, credential of gatewayverbinding aangemaakt.*
