#!/usr/bin/env bash
set -euo pipefail

BASE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql"
DOSSIER_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql"
VROEG_DRAFT="supabase/migration-drafts/20260808_acquisitie_productiekern_vroege_transactionele_functies.sql"
TRANSACTIE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

psql_safe() { psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"; }
commit_variant() { local t; t="$(mktemp)"; sed 's/^rollback;$/commit;/' "$1" > "$t"; printf '%s\n' "$t"; }
expect_failure() {
  local expected="$1" output status; shift; set +e; output="$("$@" 2>&1)"; status=$?; set -e
  [[ "$status" != "0" ]] || { echo "Verwachte fout bleef uit: $expected" >&2; exit 1; }
  [[ "$output" == *"$expected"* ]] || { echo "Onverwachte fout. Verwacht '$expected', kreeg: $output" >&2; exit 1; }
}

for draft in "$BASE_DRAFT" "$DOSSIER_DRAFT" "$VROEG_DRAFT" "$TRANSACTIE_DRAFT"; do
  [[ -f "$draft" ]] || { echo "Ontbrekend migratieconcept: $draft" >&2; exit 1; }
done

# Alleen tijdelijke CI-PostgreSQL. Geen Supabase-project wordt benaderd.
psql_safe <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE TABLE public.off_market_acquisitie_selectie (
  id uuid PRIMARY KEY,
  signaal_id uuid NOT NULL,
  archived_at timestamptz NULL
);
CREATE TABLE public.off_market_brieven (
  id uuid PRIMARY KEY,
  signaal_id uuid NOT NULL,
  brieftekst text NOT NULL,
  status text NOT NULL DEFAULT 'concept',
  onderwerp text NULL,
  objectadres text NULL,
  objectomschrijving text NULL,
  aanhef text NULL,
  eigenaar_naam text NULL,
  eigenaar_bedrijfsnaam text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT off_market_brieven_status_check CHECK (status IN ('concept','verstuurd'))
);
SQL

BASE_COMMIT="$(commit_variant "$BASE_DRAFT")"
DOSSIER_COMMIT="$(commit_variant "$DOSSIER_DRAFT")"
VROEG_COMMIT="$(commit_variant "$VROEG_DRAFT")"
TRANSACTIE_COMMIT="$(commit_variant "$TRANSACTIE_DRAFT")"
trap 'rm -f "$BASE_COMMIT" "$DOSSIER_COMMIT" "$VROEG_COMMIT" "$TRANSACTIE_COMMIT"' EXIT
psql_safe -f "$BASE_COMMIT" >/dev/null
psql_safe -f "$DOSSIER_COMMIT" >/dev/null
psql_safe -f "$VROEG_COMMIT" >/dev/null
psql_safe -f "$TRANSACTIE_COMMIT" >/dev/null

ACTOR="31000000-0000-0000-0000-000000000001"
SEL1="11000000-0000-0000-0000-000000000001"
SEL2="11000000-0000-0000-0000-000000000002"
SIG1="21000000-0000-0000-0000-000000000001"
SIG2="21000000-0000-0000-0000-000000000002"

psql_safe -qc "insert into public.off_market_acquisitie_selectie(id,signaal_id) values ('$SEL1','$SIG1'),('$SEL2','$SIG2');"

# 1. Start verwerking via echte vroege RPC, inclusief idempotente retry.
for n in 1 2; do
  psql_safe -Atqc "select * from public.off_market_verwerking_starten('11000000-0000-0000-0000-00000000000${n}','$ACTOR','e2e:start:${n}','2026-08-08T08:0${n}:00Z');" >/dev/null
done
psql_safe -Atqc "select * from public.off_market_verwerking_starten('$SEL1','$ACTOR','e2e:start:1','2026-08-08T08:01:00Z');" >/dev/null
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_acquisitie_dossiers where verwerking_gestart_op is not null and primaire_werkbak='eigenaar_achterhalen';")" == "2" ]] || { echo "E2E startverwerking faalde" >&2; exit 1; }
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where event_type='verwerking_gestart';")" == "2" ]] || { echo "E2E startaudit faalde" >&2; exit 1; }

# 2. Briefidentiteiten reserveren via RPC.
BRIEF1="$(psql_safe -Atqc "select brief_id from public.off_market_brief_reserveren('$SEL1','$ACTOR','e2e:brief:1','2026-08-08T08:10:00Z');")"
BRIEF2="$(psql_safe -Atqc "select brief_id from public.off_market_brief_reserveren('$SEL2','$ACTOR','e2e:brief:2','2026-08-08T08:11:00Z');")"
BRIEF1_RETRY="$(psql_safe -Atqc "select brief_id from public.off_market_brief_reserveren('$SEL1','$ACTOR','e2e:brief:1','2026-08-08T08:10:00Z');")"
[[ "$BRIEF1" == "$BRIEF1_RETRY" ]] || { echo "Briefreservering retry gaf andere identiteit" >&2; exit 1; }
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_brieven where selectie_id in ('$SEL1','$SEL2');")" == "2" ]] || { echo "E2E briefreservering faalde" >&2; exit 1; }

# 3. Eerste immutable briefversies via RPC; legacy spiegelvelden worden gevuld.
VERSIE1="$(psql_safe -Atqc "select brief_versie_id from public.off_market_briefversie_aanmaken('$BRIEF1','$ACTOR','e2e:versie:1','2026-08-08T08:20:00Z','{\"brieftekst\":\"Brief 1\",\"onderwerp\":\"Onderwerp 1\",\"objectadres\":\"Object 1\"}'::jsonb,'{\"naam\":\"Eigenaar 1\",\"aanhef\":\"Geachte heer/mevrouw\"}'::jsonb);")"
VERSIE2="$(psql_safe -Atqc "select brief_versie_id from public.off_market_briefversie_aanmaken('$BRIEF2','$ACTOR','e2e:versie:2','2026-08-08T08:21:00Z','{\"brieftekst\":\"Brief 2\",\"onderwerp\":\"Onderwerp 2\",\"objectadres\":\"Object 2\"}'::jsonb,'{\"naam\":\"Eigenaar 2\",\"aanhef\":\"Geachte heer/mevrouw\"}'::jsonb);")"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_brieven where id in ('$BRIEF1','$BRIEF2') and actieve_versie=1 and brieftekst<>'';")" == "2" ]] || { echo "E2E briefversiespiegel faalde" >&2; exit 1; }

# 4. Batch maken en beide specifieke versies koppelen via RPC.
BATCH="$(psql_safe -Atqc "select batch_id from public.off_market_printbatch_aanmaken('$ACTOR','e2e:batch:1','2026-08-08T08:30:00Z','2026-08-08');")"
BATCHNUMMER="$(psql_safe -Atqc "select batchnummer from public.off_market_printbatches where id='$BATCH';")"
[[ "$BATCHNUMMER" =~ ^BAT20260808[0-9]{2}$ ]] || { echo "E2E batchnummer ongeldig: $BATCHNUMMER" >&2; exit 1; }
psql_safe -qc "select public.off_market_briefversie_aan_batch_toevoegen('$BATCH','$BRIEF1','$VERSIE1','$ACTOR','e2e:koppel:1','2026-08-08T08:31:00Z');"
psql_safe -qc "select public.off_market_briefversie_aan_batch_toevoegen('$BATCH','$BRIEF2','$VERSIE2','$ACTOR','e2e:koppel:2','2026-08-08T08:32:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_printbatch_brieven where batch_id='$BATCH' and verwijderd_op is null;")" == "2" ]] || { echo "E2E batchkoppeling faalde" >&2; exit 1; }

# 5. Definitief via bestaande transactionele RPC.
for tuple in "$BRIEF1|$VERSIE1|1" "$BRIEF2|$VERSIE2|2"; do
  IFS='|' read -r brief versie n <<< "$tuple"
  psql_safe -Atqc "select * from public.off_market_brief_definitief_maken('$brief','$versie','$ACTOR','e2e:definitief:${n}',1,'2026-08-08T09:0${n}:00Z',2026);" >/dev/null
done
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_brieven where id in ('$BRIEF1','$BRIEF2') and status='definitief' and briefnummer ~ '^BR2026[0-9]{6}$';")" == "2" ]] || { echo "E2E definitiefase faalde" >&2; exit 1; }

# 6. Documenten en printen.
psql_safe -qc "select public.off_market_batch_documenten_registreren('$BATCH','$ACTOR','e2e:documenten:1',1,'2026-08-08T09:10:00Z','[{\"documenttype\":\"batchvoorblad\",\"bestand_referentie\":\"e2e/voorblad.pdf\"},{\"documenttype\":\"controlelijst\",\"bestand_referentie\":\"e2e/controlelijst.pdf\"},{\"documenttype\":\"brieven_pdf\",\"bestand_referentie\":\"e2e/brieven.pdf\"},{\"documenttype\":\"adreslabels\",\"bestand_referentie\":\"e2e/adreslabels.csv\"}]'::jsonb);"
[[ "$(psql_safe -Atqc "select status from public.off_market_printbatches where id='$BATCH';")" == "documenten_gegenereerd" ]] || { echo "E2E documentstatus faalde" >&2; exit 1; }

expect_failure batch_niet_geprint psql "$DB_URL" -v ON_ERROR_STOP=1 -qc "select public.off_market_brief_gepost_markeren('$BRIEF1','$VERSIE1','$BATCH','e2e:adres:1','$ACTOR','e2e:post:te-vroeg',1,'2026-08-08T09:15:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='e2e:post:te-vroeg';")" == "0" ]] || { echo "Te-vroege post liet audit achter" >&2; exit 1; }

psql_safe -qc "select public.off_market_batch_geprint_markeren('$BATCH','$ACTOR','e2e:print:1',1,'2026-08-08T09:20:00Z');"
psql_safe -qc "update public.off_market_acquisitie_dossiers set primaire_werkbak='geprint_posten' where selectie_id in ('$SEL1','$SEL2');"

# 7. Eerst één brief gepost: gedeeltelijk gepost en alleen die brief opvolgen.
psql_safe -qc "select public.off_market_brief_gepost_markeren('$BRIEF1','$VERSIE1','$BATCH','e2e:adres:1','$ACTOR','e2e:post:1',1,'2026-08-08T09:30:00Z');"
[[ "$(psql_safe -Atqc "select status from public.off_market_printbatches where id='$BATCH';")" == "gedeeltelijk_gepost" ]] || { echo "Partiële batchstatus faalde" >&2; exit 1; }
[[ "$(psql_safe -Atqc "select status from public.off_market_brief_versies where id='$VERSIE2';")" == "actief" ]] || { echo "Niet-geposte tweede versie wijzigde onterecht" >&2; exit 1; }
psql_safe -qc "update public.off_market_acquisitie_dossiers set primaire_werkbak='opvolgen',volgende_actie_op='2026-08-22T09:30:00Z',volgende_actie_omschrijving='Opvolgen na geposte brief' where selectie_id='$SEL1' and exists(select 1 from public.off_market_productie_events where operation_key='e2e:post:1' and event_type='brief_gepost');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_acquisitie_dossiers where primaire_werkbak='opvolgen';")" == "1" ]] || { echo "Alleen geposte brief hoort opvolging te krijgen" >&2; exit 1; }

# Retry: exact één event.
psql_safe -qc "select public.off_market_brief_gepost_markeren('$BRIEF1','$VERSIE1','$BATCH','e2e:adres:1','$ACTOR','e2e:post:1',1,'2026-08-08T09:30:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='e2e:post:1';")" == "1" ]] || { echo "Postretry is niet idempotent" >&2; exit 1; }

# 8. Tweede post voltooit batch en daarna pas tweede opvolging.
psql_safe -qc "select public.off_market_brief_gepost_markeren('$BRIEF2','$VERSIE2','$BATCH','e2e:adres:2','$ACTOR','e2e:post:2',1,'2026-08-08T09:31:00Z');"
psql_safe -qc "update public.off_market_acquisitie_dossiers set primaire_werkbak='opvolgen',volgende_actie_op='2026-08-22T09:31:00Z',volgende_actie_omschrijving='Opvolgen na geposte brief' where selectie_id='$SEL2' and exists(select 1 from public.off_market_productie_events where operation_key='e2e:post:2' and event_type='brief_gepost');"
[[ "$(psql_safe -Atqc "select status from public.off_market_printbatches where id='$BATCH';")" == "gepost" ]] || { echo "E2E eindbatch faalde" >&2; exit 1; }
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_brief_versies where id in ('$VERSIE1','$VERSIE2') and status='verzonden' and verzonden_op is not null;")" == "2" ]] || { echo "E2E verzonden versies faalden" >&2; exit 1; }
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_acquisitie_dossiers where primaire_werkbak='opvolgen' and volgende_actie_op is not null;")" == "2" ]] || { echo "E2E opvolging faalde" >&2; exit 1; }

# 9. Optimistic-lock fout op een derde, volledig via vroege RPC opgebouwde brief rolt atomisch terug.
SEL3="11000000-0000-0000-0000-000000000003"; SIG3="21000000-0000-0000-0000-000000000003"
psql_safe -qc "insert into public.off_market_acquisitie_selectie(id,signaal_id) values ('$SEL3','$SIG3');"
psql_safe -Atqc "select * from public.off_market_verwerking_starten('$SEL3','$ACTOR','e2e:start:3','2026-08-08T10:00:00Z');" >/dev/null
BRIEF3="$(psql_safe -Atqc "select brief_id from public.off_market_brief_reserveren('$SEL3','$ACTOR','e2e:brief:3','2026-08-08T10:01:00Z');")"
VERSIE3="$(psql_safe -Atqc "select brief_versie_id from public.off_market_briefversie_aanmaken('$BRIEF3','$ACTOR','e2e:versie:3','2026-08-08T10:02:00Z','{\"brieftekst\":\"Brief 3\"}'::jsonb,'{\"naam\":\"Eigenaar 3\"}'::jsonb);")"
expect_failure optimistic_lock_conflict psql "$DB_URL" -v ON_ERROR_STOP=1 -qc "select * from public.off_market_brief_definitief_maken('$BRIEF3','$VERSIE3','$ACTOR','e2e:definitief:fout',2,'2026-08-08T10:03:00Z',2026);"
[[ "$(psql_safe -Atqc "select status||'|'||coalesce(briefnummer,'') from public.off_market_brieven where id='$BRIEF3';")" == "concept|" ]] || { echo "Optimistic-lock wijzigde brief" >&2; exit 1; }
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='e2e:definitief:fout';")" == "0" ]] || { echo "Optimistic-lock liet audit achter" >&2; exit 1; }

# 10. Alle negen product-RPC's blijven zonder gerichte activatie gesloten voor clientrollen.
CLIENT_EXEC="$(psql_safe -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('off_market_verwerking_starten','off_market_brief_reserveren','off_market_briefversie_aanmaken','off_market_printbatch_aanmaken','off_market_briefversie_aan_batch_toevoegen','off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));")"
[[ "$CLIENT_EXEC" == "0" ]] || { echo "Clientrol heeft onverwachte RPC-execute: $CLIENT_EXEC" >&2; exit 1; }

echo "PRODUCTIEKERN_DAGFLOW_E2E_OK"
