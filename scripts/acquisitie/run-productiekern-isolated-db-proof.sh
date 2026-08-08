#!/usr/bin/env bash
set -euo pipefail

BASE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql"
DOSSIER_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql"
TRANSACTIE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

for draft in "$BASE_DRAFT" "$DOSSIER_DRAFT" "$TRANSACTIE_DRAFT"; do
  if [[ ! -f "$draft" ]]; then
    echo "Ontbrekend migratieconcept: $draft" >&2
    exit 1
  fi
done

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

bootstrap_roles() {
  psql_safe <<'SQL'
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
SQL
}

bootstrap_legacy_brief_shell() {
  # Uitsluitend synthetische compatibiliteitsshell voor de tijdelijke CI-db.
  # Dit is nadrukkelijk geen bewijs van actuele productie-DDL.
  psql_safe <<'SQL'
CREATE TABLE IF NOT EXISTS public.off_market_brieven (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'concept'
);
SQL
}

assert_clean_base_schema() {
  local aantal
  aantal="$(psql_safe -Atqc "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (c.relname like 'off_market_productie_%' or c.relname in ('off_market_brief_versies','off_market_printbatches','off_market_printbatch_brieven','off_market_batchdocumenten'));")"
  if [[ "$aantal" != "0" ]]; then
    echo "Rollbackproef liet productiekernobjecten achter: $aantal" >&2
    exit 1
  fi
}

assert_dossier_rollback_clean() {
  local dossier_count kolom_count
  dossier_count="$(psql_safe -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_name='off_market_acquisitie_dossiers';")"
  kolom_count="$(psql_safe -Atqc "select count(*) from information_schema.columns where table_schema='public' and table_name='off_market_brieven' and column_name in ('briefnummer','selectie_id','object_id','relatie_id','actieve_versie','vervanging_van_brief_id','definitief_op','vergrendeld_op','annuleringsreden');")"
  if [[ "$dossier_count" != "0" || "$kolom_count" != "0" ]]; then
    echo "Dossier-/briefkernrollback liet wijzigingen achter: dossier=$dossier_count kolommen=$kolom_count" >&2
    exit 1
  fi
}

assert_transactie_rollback_clean() {
  local functie_count
  functie_count="$(psql_safe -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren');")"
  if [[ "$functie_count" != "0" ]]; then
    echo "Transactionele rollback liet functies achter: $functie_count" >&2
    exit 1
  fi
}

bootstrap_roles

# 1. Exacte rollbackproef van het basisschema.
psql_safe -f "$BASE_DRAFT"
assert_clean_base_schema

echo "BASE_SCHEMA_ROLLBACK_PROOF_OK"

# 2. Commitvariant van het basisschema, uitsluitend in de tijdelijke CI-db.
BASE_COMMIT_DRAFT="$(commit_variant "$BASE_DRAFT")"
psql_safe -f "$BASE_COMMIT_DRAFT"

# 3. De dossier-/briefkern heeft bewust een bestaande off_market_brieven-tabel
# nodig. We leveren alleen de minimaal benodigde synthetische shell.
bootstrap_legacy_brief_shell
psql_safe -f "$DOSSIER_DRAFT"
assert_dossier_rollback_clean

echo "DOSSIER_BRIEFKERN_ROLLBACK_PROOF_OK"

DOSSIER_COMMIT_DRAFT="$(commit_variant "$DOSSIER_DRAFT")"
psql_safe -f "$DOSSIER_COMMIT_DRAFT"

# 4. Transactionele functies exact uitvoeren met ROLLBACK op de gecombineerde
# tijdelijke schemastructuur en aantonen dat geen functies achterblijven.
psql_safe -f "$TRANSACTIE_DRAFT"
assert_transactie_rollback_clean

echo "TRANSACTIONELE_FUNCTIES_ROLLBACK_PROOF_OK"

TRANSACTIE_COMMIT_DRAFT="$(commit_variant "$TRANSACTIE_DRAFT")"
psql_safe -f "$TRANSACTIE_COMMIT_DRAFT"

# 5. Concurrencyproef nummerreeksen.
rm -f /tmp/briefnummer-*.txt /tmp/batchnummer-*.txt
seq 1 20 | xargs -P 10 -I{} bash -c \
  'psql "$0" -v ON_ERROR_STOP=1 -Atqc "select public.reserveer_off_market_briefnummer(2026);" > "/tmp/briefnummer-$1.txt"' \
  "$DB_URL" '{}'
cat /tmp/briefnummer-*.txt | sort > /tmp/briefnummers.txt

brief_count="$(sort -u /tmp/briefnummers.txt | wc -l | tr -d ' ')"
brief_first="$(head -n 1 /tmp/briefnummers.txt)"
brief_last="$(tail -n 1 /tmp/briefnummers.txt)"
if [[ "$brief_count" != "20" || "$brief_first" != "BR2026000001" || "$brief_last" != "BR2026000020" ]]; then
  echo "Concurrencyproef briefnummers faalde: count=$brief_count first=$brief_first last=$brief_last" >&2
  exit 1
fi

seq 1 20 | xargs -P 10 -I{} bash -c \
  'psql "$0" -v ON_ERROR_STOP=1 -Atqc "select public.reserveer_off_market_batchnummer(date '\''2026-08-08'\'');" > "/tmp/batchnummer-$1.txt"' \
  "$DB_URL" '{}'
cat /tmp/batchnummer-*.txt | sort > /tmp/batchnummers.txt

batch_count="$(sort -u /tmp/batchnummers.txt | wc -l | tr -d ' ')"
batch_first="$(head -n 1 /tmp/batchnummers.txt)"
batch_last="$(tail -n 1 /tmp/batchnummers.txt)"
if [[ "$batch_count" != "20" || "$batch_first" != "BAT2026080801" || "$batch_last" != "BAT2026080820" ]]; then
  echo "Concurrencyproef batchnummers faalde: count=$batch_count first=$batch_first last=$batch_last" >&2
  exit 1
fi

# 6. Audit-idempotentie onder gelijktijdige inserts.
rm -f /tmp/audit-*.status
set +e
for i in 1 2; do
  (
    psql "$DB_URL" -v ON_ERROR_STOP=1 -qc "insert into public.off_market_productie_events (id, operation_key, event_type) values ('00000000-0000-0000-0000-00000000000${i}', 'proof:same-operation', 'verwerking_gestart');"
    echo $? > "/tmp/audit-$i.status"
  ) &
done
wait
set -e

audit_rows="$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='proof:same-operation';")"
if [[ "$audit_rows" != "1" ]]; then
  echo "Audit-idempotentieproef faalde: rows=$audit_rows" >&2
  exit 1
fi

successes=0
failures=0
for status_file in /tmp/audit-*.status; do
  status="$(cat "$status_file")"
  if [[ "$status" == "0" ]]; then
    successes=$((successes + 1))
  else
    failures=$((failures + 1))
  fi
done
if [[ "$successes" != "1" || "$failures" != "1" ]]; then
  echo "Audit-idempotentie verwacht 1 succes en 1 unique-conflict; successes=$successes failures=$failures" >&2
  exit 1
fi

# 7. Praktische postregistratie-idempotentie via de transactionele RPC-functie.
# Eén geposte brief in een expliciet geprinte batch; twee gelijktijdige retries
# met dezelfde operation_key moeten samen exact één event en eindstatus geven.
psql_safe <<'SQL'
INSERT INTO public.off_market_brieven (id, status, briefnummer, actieve_versie, definitief_op, vergrendeld_op)
VALUES ('10000000-0000-0000-0000-000000000001', 'definitief', 'BR2026999999', 1, now(), now());

INSERT INTO public.off_market_brief_versies (
  id, brief_id, versienummer, status, inhoud_snapshot, geadresseerde_snapshot
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  1,
  'actief',
  '{}'::jsonb,
  '{}'::jsonb
);

INSERT INTO public.off_market_printbatches (
  id, batchnummer, status, documentversie, printdatum
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'BAT2026080899',
  'geprint',
  1,
  now()
);

INSERT INTO public.off_market_printbatch_brieven (
  id, batch_id, brief_id, brief_versie_id
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001'
);
SQL

rm -f /tmp/post-*.status
for i in 1 2; do
  (
    psql "$DB_URL" -v ON_ERROR_STOP=1 -qc "select public.off_market_brief_gepost_markeren('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','proof:geadresseerde','50000000-0000-0000-0000-000000000001','proof:post:same-operation',1,'2026-08-08T12:00:00Z');"
    echo $? > "/tmp/post-$i.status"
  ) &
done
wait

post_event_rows="$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='proof:post:same-operation' and event_type='brief_gepost';")"
brief_status="$(psql_safe -Atqc "select status from public.off_market_brief_versies where id='20000000-0000-0000-0000-000000000001';")"
batch_status="$(psql_safe -Atqc "select status from public.off_market_printbatches where id='30000000-0000-0000-0000-000000000001';")"
if [[ "$post_event_rows" != "1" || "$brief_status" != "verzonden" || "$batch_status" != "gepost" ]]; then
  echo "Postregistratie-idempotentie faalde: events=$post_event_rows brief=$brief_status batch=$batch_status" >&2
  exit 1
fi

echo "CONCURRENCY_IDEMPOTENCY_PROOF_OK"

rm -f "$BASE_COMMIT_DRAFT" "$DOSSIER_COMMIT_DRAFT" "$TRANSACTIE_COMMIT_DRAFT"
