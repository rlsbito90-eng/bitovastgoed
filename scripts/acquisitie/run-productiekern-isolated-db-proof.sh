#!/usr/bin/env bash
set -euo pipefail

DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

if [[ ! -f "$DRAFT" ]]; then
  echo "Ontbrekend migratieconcept: $DRAFT" >&2
  exit 1
fi

psql_safe() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"
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

assert_clean_schema() {
  local aantal
  aantal="$(psql_safe -Atqc "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'off_market_productie_%' or n.nspname='public' and c.relname in ('off_market_brief_versies','off_market_printbatches','off_market_printbatch_brieven','off_market_batchdocumenten');")"
  if [[ "$aantal" != "0" ]]; then
    echo "Rollbackproef liet productiekernobjecten achter: $aantal" >&2
    exit 1
  fi
}

bootstrap_roles

# 1. Schema-only rollbackproef: voer exact het reviewconcept uit. Het bestand
# eindigt bewust met ROLLBACK en moet dus geen schemaobjecten achterlaten.
psql_safe -f "$DRAFT"
assert_clean_schema

echo "SCHEMA_ROLLBACK_PROOF_OK"

# 2. Concurrencyproef in dezelfde geïsoleerde CI-database. Alleen voor deze
# tijdelijke database vervangen we de slot-ROLLBACK door COMMIT, zodat de
# nummerfuncties onder echte gelijktijdigheid kunnen worden aangeroepen.
COMMIT_DRAFT="$(mktemp)"
sed 's/^rollback;$/commit;/' "$DRAFT" > "$COMMIT_DRAFT"
psql_safe -f "$COMMIT_DRAFT"

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

# 3. Idempotentiegarantie van de kritieke audittrail: dezelfde operation_key
# mag maar één record opleveren, ook wanneer twee sessies tegelijk schrijven.
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

echo "CONCURRENCY_IDEMPOTENCY_PROOF_OK"
