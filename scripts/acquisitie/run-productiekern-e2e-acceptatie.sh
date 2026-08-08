#!/usr/bin/env bash
set -euo pipefail

BASE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql"
DOSSIER_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql"
TRANSACTIE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

psql_safe() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"
}

commit_variant() {
  local source="$1"
  local target
  target="$(mktemp)"
  sed 's/^rollback;$/commit;/' "$source" > "$target"
  printf '%s\n' "$target"
}

expect_failure() {
  local expected="$1"
  shift
  local output status
  set +e
  output="$($@ 2>&1)"
  status=$?
  set -e
  if [[ "$status" == "0" ]]; then
    echo "Verwachte fout bleef uit: $expected" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    echo "Onverwachte fout. Verwacht '$expected', kreeg: $output" >&2
    exit 1
  fi
}

for draft in "$BASE_DRAFT" "$DOSSIER_DRAFT" "$TRANSACTIE_DRAFT"; do
  [[ -f "$draft" ]] || { echo "Ontbrekend migratieconcept: $draft" >&2; exit 1; }
done

# Volledig geïsoleerde acceptatieomgeving. De GitHub Actions servicecontainer is
# tijdelijk; dit reset uitsluitend die CI-database en raakt geen Supabase-project.
psql_safe <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- Realistische minimale legacy-shell: juist de live statusconstraint die tijdens
-- de read-only productieprobe is aangetroffen.
CREATE TABLE public.off_market_brieven (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'concept',
  CONSTRAINT off_market_brieven_status_check
    CHECK (status IN ('concept', 'verstuurd'))
);
SQL

BASE_COMMIT="$(commit_variant "$BASE_DRAFT")"
DOSSIER_COMMIT="$(commit_variant "$DOSSIER_DRAFT")"
TRANSACTIE_COMMIT="$(commit_variant "$TRANSACTIE_DRAFT")"
trap 'rm -f "$BASE_COMMIT" "$DOSSIER_COMMIT" "$TRANSACTIE_COMMIT"' EXIT

psql_safe -f "$BASE_COMMIT" >/dev/null
psql_safe -f "$DOSSIER_COMMIT" >/dev/null
psql_safe -f "$TRANSACTIE_COMMIT" >/dev/null

# ---------------------------------------------------------------------------
# HAPPY PATH — twee geadresseerden in één batch
# selectie/dossier -> brief -> definitief -> documenten -> geprint ->
# gedeeltelijk gepost -> volledig gepost -> opvolgen.
# ---------------------------------------------------------------------------
psql_safe <<'SQL'
INSERT INTO public.off_market_acquisitie_dossiers (
  id, selectie_id, signaal_id, verwerking_gestart_op, verwerking_gestart_door,
  primaire_werkbak
) VALUES
  ('01000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','2026-08-08T08:00:00Z','31000000-0000-0000-0000-000000000001','brief_opstellen'),
  ('01000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','2026-08-08T08:00:00Z','31000000-0000-0000-0000-000000000001','brief_opstellen');

INSERT INTO public.off_market_brieven (
  id, status, selectie_id, actieve_versie
) VALUES
  ('41000000-0000-0000-0000-000000000001','concept','11000000-0000-0000-0000-000000000001',1),
  ('41000000-0000-0000-0000-000000000002','concept','11000000-0000-0000-0000-000000000002',1);

INSERT INTO public.off_market_brief_versies (
  id, brief_id, versienummer, status, inhoud_snapshot, geadresseerde_snapshot
) VALUES
  ('51000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001',1,'actief',
   '{"onderwerp":"Acquisitie","brieftekst":"Brief 1"}'::jsonb,
   '{"naam":"Eigenaar 1","straatHuisnummer":"Teststraat 1","postcode":"1000AA","plaats":"Teststad","land":"Nederland"}'::jsonb),
  ('51000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002',1,'actief',
   '{"onderwerp":"Acquisitie","brieftekst":"Brief 2"}'::jsonb,
   '{"naam":"Eigenaar 2","straatHuisnummer":"Teststraat 2","postcode":"1000AB","plaats":"Teststad","land":"Nederland"}'::jsonb);

INSERT INTO public.off_market_printbatches (
  id, batchnummer, status, documentversie
) VALUES ('61000000-0000-0000-0000-000000000001','BAT2026080801','concept',1);

INSERT INTO public.off_market_printbatch_brieven (
  id, batch_id, brief_id, brief_versie_id
) VALUES
  ('71000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002');
SQL

psql_safe -Atqc "select * from public.off_market_brief_definitief_maken('41000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','e2e:definitief:1',1,'2026-08-08T09:00:00Z',2026);" >/dev/null
psql_safe -Atqc "select * from public.off_market_brief_definitief_maken('41000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','e2e:definitief:2',1,'2026-08-08T09:01:00Z',2026);" >/dev/null

brief_statussen="$(psql_safe -Atqc "select string_agg(status, ',' order by id) from public.off_market_brieven where id in ('41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002');")"
briefnummers="$(psql_safe -Atqc "select count(distinct briefnummer) from public.off_market_brieven where id in ('41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002') and briefnummer ~ '^BR2026[0-9]{6}$';")"
if [[ "$brief_statussen" != "definitief,definitief" || "$briefnummers" != "2" ]]; then
  echo "E2E definitiefase faalde: statussen=$brief_statussen nummers=$briefnummers" >&2
  exit 1
fi

psql_safe -qc "select public.off_market_batch_documenten_registreren(
  '61000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'e2e:documenten:1',1,'2026-08-08T09:10:00Z',
  '[
    {\"documenttype\":\"batchvoorblad\",\"bestand_referentie\":\"e2e/voorblad.pdf\"},
    {\"documenttype\":\"controlelijst\",\"bestand_referentie\":\"e2e/controlelijst.pdf\"},
    {\"documenttype\":\"brieven_pdf\",\"bestand_referentie\":\"e2e/brieven.pdf\"},
    {\"documenttype\":\"adreslabels\",\"bestand_referentie\":\"e2e/adreslabels.csv\"}
  ]'::jsonb);"

doc_status="$(psql_safe -Atqc "select status from public.off_market_printbatches where id='61000000-0000-0000-0000-000000000001';")"
doc_count="$(psql_safe -Atqc "select count(*) from public.off_market_batchdocumenten where batch_id='61000000-0000-0000-0000-000000000001' and status='actief';")"
if [[ "$doc_status" != "documenten_gegenereerd" || "$doc_count" != "4" ]]; then
  echo "E2E documentfase faalde: status=$doc_status documenten=$doc_count" >&2
  exit 1
fi

# Een postactie vóór expliciet printen moet hard falen en mag geen opvolging
# mogelijk maken.
expect_failure "batch_niet_geprint" psql "$DB_URL" -v ON_ERROR_STOP=1 -qc \
  "select public.off_market_brief_gepost_markeren('41000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','e2e:adres:1','31000000-0000-0000-0000-000000000001','e2e:post:te-vroeg',1,'2026-08-08T09:15:00Z');"

te_vroeg_events="$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='e2e:post:te-vroeg';")"
te_vroeg_opvolging="$(psql_safe -Atqc "select count(*) from public.off_market_acquisitie_dossiers where id='01000000-0000-0000-0000-000000000001' and volgende_actie_op is not null;")"
if [[ "$te_vroeg_events" != "0" || "$te_vroeg_opvolging" != "0" ]]; then
  echo "E2E fail-closed vóór print faalde: events=$te_vroeg_events opvolging=$te_vroeg_opvolging" >&2
  exit 1
fi

psql_safe -qc "select public.off_market_batch_geprint_markeren('61000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','e2e:print:1',1,'2026-08-08T09:20:00Z');"
psql_safe -qc "update public.off_market_acquisitie_dossiers set primaire_werkbak='geprint_posten' where id in ('01000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000002');"

# Eerste van twee brieven posten: batch moet gedeeltelijk gepost blijven en alleen
# dit dossier mag naar opvolgen.
psql_safe -qc "select public.off_market_brief_gepost_markeren('41000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','e2e:adres:1','31000000-0000-0000-0000-000000000001','e2e:post:1',1,'2026-08-08T09:30:00Z');"

partial_status="$(psql_safe -Atqc "select status from public.off_market_printbatches where id='61000000-0000-0000-0000-000000000001';")"
versie_statussen="$(psql_safe -Atqc "select string_agg(status, ',' order by id) from public.off_market_brief_versies where id in ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002');")"
if [[ "$partial_status" != "gedeeltelijk_gepost" || "$versie_statussen" != "verzonden,actief" ]]; then
  echo "E2E gedeeltelijke post faalde: batch=$partial_status versies=$versie_statussen" >&2
  exit 1
fi

psql_safe -qc "update public.off_market_acquisitie_dossiers
  set primaire_werkbak='opvolgen', volgende_actie_op='2026-08-22T09:30:00Z', volgende_actie_omschrijving='Opvolgen na geposte brief'
  where id='01000000-0000-0000-0000-000000000001'
    and exists (select 1 from public.off_market_productie_events where operation_key='e2e:post:1' and event_type='brief_gepost');"

# Idempotente retry: zelfde operation_key mag geen tweede event maken.
psql_safe -qc "select public.off_market_brief_gepost_markeren('41000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','e2e:adres:1','31000000-0000-0000-0000-000000000001','e2e:post:1',1,'2026-08-08T09:30:00Z');"
retry_count="$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='e2e:post:1' and event_type='brief_gepost';")"
if [[ "$retry_count" != "1" ]]; then
  echo "E2E post-retry is niet idempotent: events=$retry_count" >&2
  exit 1
fi

# Tweede brief posten voltooit de batch; pas daarna krijgt ook dossier 2 opvolging.
psql_safe -qc "select public.off_market_brief_gepost_markeren('41000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000001','e2e:adres:2','31000000-0000-0000-0000-000000000001','e2e:post:2',1,'2026-08-08T09:31:00Z');"
psql_safe -qc "update public.off_market_acquisitie_dossiers
  set primaire_werkbak='opvolgen', volgende_actie_op='2026-08-22T09:31:00Z', volgende_actie_omschrijving='Opvolgen na geposte brief'
  where id='01000000-0000-0000-0000-000000000002'
    and exists (select 1 from public.off_market_productie_events where operation_key='e2e:post:2' and event_type='brief_gepost');"

final_batch="$(psql_safe -Atqc "select status from public.off_market_printbatches where id='61000000-0000-0000-0000-000000000001';")"
final_versies="$(psql_safe -Atqc "select count(*) from public.off_market_brief_versies where id in ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002') and status='verzonden' and verzonden_op is not null;")"
final_opvolging="$(psql_safe -Atqc "select count(*) from public.off_market_acquisitie_dossiers where id in ('01000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000002') and primaire_werkbak='opvolgen' and volgende_actie_op is not null;")"
post_events="$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key in ('e2e:post:1','e2e:post:2') and event_type='brief_gepost';")"
if [[ "$final_batch" != "gepost" || "$final_versies" != "2" || "$final_opvolging" != "2" || "$post_events" != "2" ]]; then
  echo "E2E eindtoestand faalde: batch=$final_batch versies=$final_versies opvolging=$final_opvolging events=$post_events" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# FOUTPAD — optimistic lock bij definitief maken.
# Geen nummer, statusmutatie of audit-event bij verkeerd verwacht versienummer.
# ---------------------------------------------------------------------------
psql_safe <<'SQL'
INSERT INTO public.off_market_brieven (id, status, selectie_id, actieve_versie)
VALUES ('41000000-0000-0000-0000-000000000003','concept','11000000-0000-0000-0000-000000000003',1);
INSERT INTO public.off_market_brief_versies (
  id, brief_id, versienummer, status, inhoud_snapshot, geadresseerde_snapshot
) VALUES (
  '51000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000003',1,'actief','{}'::jsonb,'{}'::jsonb
);
SQL

expect_failure "optimistic_lock_conflict" psql "$DB_URL" -v ON_ERROR_STOP=1 -qc \
  "select * from public.off_market_brief_definitief_maken('41000000-0000-0000-0000-000000000003','51000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000001','e2e:definitief:conflict',2,'2026-08-08T10:00:00Z',2026);"

conflict_state="$(psql_safe -Atqc "select status || ':' || coalesce(briefnummer,'NULL') from public.off_market_brieven where id='41000000-0000-0000-0000-000000000003';")"
conflict_events="$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='e2e:definitief:conflict';")"
if [[ "$conflict_state" != "concept:NULL" || "$conflict_events" != "0" ]]; then
  echo "E2E optimistic-lock rollback faalde: state=$conflict_state events=$conflict_events" >&2
  exit 1
fi

# Clientrollen mogen de transactionele functies ook in de acceptatieomgeving niet
# rechtstreeks uitvoeren.
execute_grants="$(psql_safe -Atqc "
select count(*)
from information_schema.routine_privileges
where routine_schema='public'
  and routine_name in ('off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren')
  and grantee in ('PUBLIC','anon','authenticated')
  and privilege_type='EXECUTE';")"
if [[ "$execute_grants" != "0" ]]; then
  echo "E2E beveiligingsgrens faalde: client execute grants=$execute_grants" >&2
  exit 1
fi

echo "PRODUCTIEKERN_DAGFLOW_E2E_ACCEPTATIE_OK"
