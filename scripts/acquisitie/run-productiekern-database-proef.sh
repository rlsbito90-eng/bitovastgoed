#!/usr/bin/env bash
set -euo pipefail

DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
WERKMAP="${RUNNER_TEMP:-/tmp}/acquisitie-productiekern-proef"
COMMIT_DRAFT="$WERKMAP/productiekern-ephemeral-commit.sql"

mkdir -p "$WERKMAP"

if [[ ! -f "$DRAFT" ]]; then
  echo "Draft ontbreekt: $DRAFT" >&2
  exit 1
fi

psql_cmd() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

scalar() {
  psql_cmd -Atqc "$1"
}

expected_relations=(
  off_market_productie_nummerreeksen
  off_market_brief_versies
  off_market_printbatches
  off_market_printbatch_brieven
  off_market_batchdocumenten
  off_market_productie_events
)

relation_list=$(printf "'%s'," "${expected_relations[@]}")
relation_list="${relation_list%,}"

# 1. Schema-only rollbackproef: voer het echte reviewdraft uit en bewijs dat
#    geen schemaobject achterblijft.
psql_cmd -f "$DRAFT" >/dev/null

relation_count=$(scalar "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ($relation_list);")
function_count=$(scalar "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('reserveer_off_market_briefnummer','reserveer_off_market_batchnummer');")

if [[ "$relation_count" != "0" || "$function_count" != "0" ]]; then
  echo "Rollbackproef faalt: relaties=$relation_count functies=$function_count" >&2
  exit 1
fi

echo "schema_rollback_proef_ok relaties=0 functies=0"

# 2. Voor uitsluitend deze tijdelijke CI-database maken we een kopie waarin
#    de afsluitende rollback éénmalig commit wordt. Het repositorydraft zelf
#    blijft ongewijzigd en wordt nergens naar Supabase gestuurd.
python3 - "$DRAFT" "$COMMIT_DRAFT" <<'PY'
from pathlib import Path
import sys
src = Path(sys.argv[1]).read_text()
needle = "\nrollback;\n"
if src.count(needle) != 1:
    raise SystemExit(f"verwacht exact één standalone rollback; gevonden={src.count(needle)}")
Path(sys.argv[2]).write_text(src.replace(needle, "\ncommit;\n", 1))
PY

psql_cmd -f "$COMMIT_DRAFT" >/dev/null

relation_count=$(scalar "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ($relation_list);")
function_count=$(scalar "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('reserveer_off_market_briefnummer','reserveer_off_market_batchnummer');")

if [[ "$relation_count" != "6" || "$function_count" != "2" ]]; then
  echo "Ephemeral schema faalt: relaties=$relation_count functies=$function_count" >&2
  exit 1
fi

echo "ephemeral_schema_apply_ok relaties=6 functies=2"

# 3. Concurrencyproef nummerreeksen: gelijktijdige sessies moeten unieke,
#    aaneengesloten nummers produceren.
export DATABASE_URL
seq 1 40 | xargs -P 20 -I{} bash -c \
  'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select public.reserveer_off_market_briefnummer(2026);"' \
  > "$WERKMAP/briefnummers.txt"

brief_total=$(wc -l < "$WERKMAP/briefnummers.txt" | tr -d ' ')
brief_unique=$(sort -u "$WERKMAP/briefnummers.txt" | wc -l | tr -d ' ')
brief_min=$(sort "$WERKMAP/briefnummers.txt" | head -n 1)
brief_max=$(sort "$WERKMAP/briefnummers.txt" | tail -n 1)

if [[ "$brief_total" != "40" || "$brief_unique" != "40" || "$brief_min" != "BR2026000001" || "$brief_max" != "BR2026000040" ]]; then
  echo "Briefnummer concurrency faalt: totaal=$brief_total uniek=$brief_unique min=$brief_min max=$brief_max" >&2
  exit 1
fi

seq 1 20 | xargs -P 20 -I{} bash -c \
  'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select public.reserveer_off_market_batchnummer(date '\''2026-08-08'\'');"' \
  > "$WERKMAP/batchnummers.txt"

batch_total=$(wc -l < "$WERKMAP/batchnummers.txt" | tr -d ' ')
batch_unique=$(sort -u "$WERKMAP/batchnummers.txt" | wc -l | tr -d ' ')
batch_min=$(sort "$WERKMAP/batchnummers.txt" | head -n 1)
batch_max=$(sort "$WERKMAP/batchnummers.txt" | tail -n 1)

if [[ "$batch_total" != "20" || "$batch_unique" != "20" || "$batch_min" != "BAT2026080801" || "$batch_max" != "BAT2026080820" ]]; then
  echo "Batchnummer concurrency faalt: totaal=$batch_total uniek=$batch_unique min=$batch_min max=$batch_max" >&2
  exit 1
fi

echo "nummer_concurrency_proef_ok brief=40 batch=20"

# 4. Idempotentie/audit: dezelfde operation_key mag onder concurrentie maar
#    één auditrecord opleveren. ON CONFLICT simuleert veilige retry.
seq 1 20 | xargs -P 20 -I{} bash -c \
  'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "insert into public.off_market_productie_events (id, operation_key, event_type) values (gen_random_uuid(), '\''op:test:zelfde'\'', '\''afwijking_geregistreerd'\'') on conflict (operation_key) do nothing;"'

audit_count=$(scalar "select count(*) from public.off_market_productie_events where operation_key='op:test:zelfde';")
if [[ "$audit_count" != "1" ]]; then
  echo "Audit-idempotentie faalt: records=$audit_count" >&2
  exit 1
fi

echo "audit_idempotentie_proef_ok records=1"

# 5. Immutabiliteits-/uniciteitsgrens: per brief mag slechts één actieve
#    briefversie bestaan, ook bij gelijktijdige retries.
BRIEF_ID="11111111-1111-4111-8111-111111111111"
export BRIEF_ID
seq 1 20 | xargs -P 20 -I{} bash -c \
  'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "insert into public.off_market_brief_versies (id, brief_id, versienummer, status, inhoud_snapshot, geadresseerde_snapshot) values (gen_random_uuid(), '\''$BRIEF_ID'\'', {}, '\''actief'\'', '\''{}'\''::jsonb, '\''{}'\''::jsonb) on conflict do nothing;"'

active_version_count=$(scalar "select count(*) from public.off_market_brief_versies where brief_id='$BRIEF_ID' and status='actief';")
if [[ "$active_version_count" != "1" ]]; then
  echo "Actieve briefversie-uniciteit faalt: records=$active_version_count" >&2
  exit 1
fi

echo "actieve_briefversie_concurrency_proef_ok records=1"

echo "ACQUISITIE_PRODUCTIEKERN_DATABASE_PROEF_OK"
