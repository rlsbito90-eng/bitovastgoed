#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is verplicht}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is verplicht}"
: "${LOVABLE_PROJECT_ID:?LOVABLE_PROJECT_ID is verplicht}"
: "${BAG_SCALE_APPROVAL:?BAG_SCALE_APPROVAL is verplicht}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/bag-2a5-shadow-scale-probe}"
SAMPLE_ROWS="${BAG_SCALE_SAMPLE_ROWS:-100000}"
DATASET_ID="${BAG_SCALE_DATASET_ID:-900000005}"
SHADOW_REF="6a89a812-bc24-4545-8da4-dcf44e209fcf"
PRODUCTION_REF="ljudxyrqoifhfikueric"

if [[ "$BAG_SCALE_APPROVAL" != "APPLY_BAG_SCALE_PROBE_2A5" ]]; then
  echo "Weigering: onjuiste expliciete 2A.5-goedkeuring." >&2
  exit 1
fi

if [[ "$LOVABLE_PROJECT_ID" != "$SHADOW_REF" || "$SUPABASE_PROJECT_REF" == "$PRODUCTION_REF" ]]; then
  echo "Weigering: 2A.5 mag uitsluitend op de afgescheiden shadow draaien." >&2
  exit 1
fi

if [[ "$DATABASE_URL" != *"$SUPABASE_PROJECT_REF"* || "$DATABASE_URL" == *"$PRODUCTION_REF"* ]]; then
  echo "Weigering: databasehost en opgegeven shadowref sluiten niet aan." >&2
  exit 1
fi

if [[ "$DATABASE_URL" != *"sslmode=require"* ]]; then
  echo "Weigering: DATABASE_URL moet sslmode=require bevatten." >&2
  exit 1
fi

if ! [[ "$SAMPLE_ROWS" =~ ^[0-9]+$ ]] || (( SAMPLE_ROWS < 1000 || SAMPLE_ROWS > 250000 )); then
  echo "Weigering: BAG_SCALE_SAMPLE_ROWS moet tussen 1.000 en 250.000 liggen." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v dataset_id="$DATASET_ID" \
    -f "$ROOT_DIR/experiments/bag/2a5/cleanup-scale-shadow.sql" \
    >"$OUTPUT_DIR/cleanup.log" 2>&1
}
trap cleanup EXIT

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At <<'SQL' >"$OUTPUT_DIR/preflight.tsv"
SELECT current_database(), current_user, pg_database_size(current_database());
SELECT count(*) FROM pg_catalog.pg_namespace
WHERE nspname IN ('bag_control', 'bag_staging', 'bag_published');
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v dataset_id="$DATASET_ID" -v sample_rows="$SAMPLE_ROWS" \
  -f "$ROOT_DIR/experiments/bag/2a5/load-scale-shadow.sql" \
  >"$OUTPUT_DIR/load.log" 2>&1

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v dataset_id="$DATASET_ID" -v sample_rows="$SAMPLE_ROWS" \
  -f "$ROOT_DIR/experiments/bag/2a5/publish-measure-scale-shadow.sql" \
  >"$OUTPUT_DIR/publish-measure.log" 2>&1

cleanup
trap - EXIT

rg -q "2A.5_SCALE_LOAD_OK" "$OUTPUT_DIR/load.log"
rg -q "2A.5_SCALE_PUBLISH_QUERY_OK" "$OUTPUT_DIR/publish-measure.log"
rg -q "2A.5_SCALE_CLEANUP_OK" "$OUTPUT_DIR/cleanup.log"

echo "BUILD 2A.5 shadow-schaalproef groen: $SAMPLE_ROWS synthetische records per BAG-laag."
