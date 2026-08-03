#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is verplicht en moet naar de tijdelijke testdatabase wijzen}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/bag-2a2-capaciteitsproef}"
SCHEMA_SQL="$ROOT_DIR/experiments/bag/2a2/schema.sql"
LOAD_SQL="$ROOT_DIR/experiments/bag/2a2/load-volumeprofiel.sql"

mkdir -p "$OUTPUT_DIR"

if [[ "$DATABASE_URL" != *"localhost"* && "$DATABASE_URL" != *"127.0.0.1"* ]]; then
  echo "Weigering: BUILD 2A.2 mag uitsluitend tegen een lokale tijdelijke database draaien." >&2
  exit 1
fi

for bestand in "$SCHEMA_SQL" "$LOAD_SQL"; do
  test -s "$bestand"
done

start_epoch="$(date +%s)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL" >"$OUTPUT_DIR/schema.log" 2>&1
schema_epoch="$(date +%s)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$LOAD_SQL" >"$OUTPUT_DIR/load.log" 2>&1
load_epoch="$(date +%s)"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' >"$OUTPUT_DIR/tellingen.tsv"
SET search_path TO bag_experiment, public;
SELECT 'staging_objecten', count(*) FROM staging_objecten;
SELECT 'staging_voorkomens', count(*) FROM staging_voorkomens;
SELECT 'staging_relaties', count(*) FROM staging_relaties;
SELECT 'staging_geometrieen', count(*) FROM staging_geometrieen;
SELECT 'published_objecten', count(*) FROM objecten;
SELECT 'published_voorkomens', count(*) FROM voorkomens;
SELECT 'published_relaties', count(*) FROM relaties;
SELECT 'published_geometrieen', count(*) FROM geometrieen;
SELECT 'actieve_datasetversies', count(*) FROM datasetversies WHERE is_actief;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' >"$OUTPUT_DIR/opslag.tsv"
SELECT
  c.relname,
  pg_relation_size(c.oid),
  pg_indexes_size(c.oid),
  pg_total_relation_size(c.oid)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'bag_experiment'
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC, c.relname;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At <<'SQL' >"$OUTPUT_DIR/postgis.txt"
SELECT postgis_full_version();
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At <<'SQL' >"$OUTPUT_DIR/queryplannen.txt"
SET search_path TO bag_experiment, public;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT identificatie
FROM geometrieen
WHERE geometrie && ST_MakeEnvelope(100000, 450000, 101000, 451000, 28992)
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT v.identificatie, v.status
FROM voorkomens v
WHERE v.datasetversie_id = 1
  AND v.objecttype = 'Pand'
  AND v.is_actueel = true
LIMIT 100;
SQL

rollback_voor="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT status || ':' || is_actief FROM bag_experiment.datasetversies WHERE id = 1")"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' >"$OUTPUT_DIR/rollback.log" 2>&1
BEGIN;
UPDATE bag_experiment.datasetversies
SET status = 'vervangen', is_actief = false
WHERE id = 1;
ROLLBACK;
SQL
rollback_na="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT status || ':' || is_actief FROM bag_experiment.datasetversies WHERE id = 1")"

if [[ "$rollback_voor" != "$rollback_na" ]]; then
  echo "Rollbacktest mislukt: vóór=$rollback_voor, na=$rollback_na" >&2
  exit 1
fi

schema_seconden=$((schema_epoch - start_epoch))
load_seconden=$((load_epoch - schema_epoch))
totaal_seconden=$((load_epoch - start_epoch))
totale_bytes="$(awk -F '\t' '{som += $4} END {printf "%.0f", som}' "$OUTPUT_DIR/opslag.tsv")"

cat >"$OUTPUT_DIR/resultaat.json" <<JSON
{
  "experiment": "BAG BUILD 2A.2 geïsoleerde PostGIS-capaciteitsproef",
  "gegevens": "synthetisch deterministisch volumeprofiel gebaseerd op de Assen-dry-run",
  "productiedatabaseGebruikt": false,
  "crmSchrijfacties": false,
  "volume": {
    "objecten": 128745,
    "voorkomens": 168047,
    "relaties": 212738,
    "geometrieen": 122388
  },
  "duurSeconden": {
    "schema": $schema_seconden,
    "ladenEnPubliceren": $load_seconden,
    "totaal": $totaal_seconden
  },
  "totaleTabelEnIndexBytes": $totale_bytes,
  "rollbackBehouden": true
}
JSON

cat >"$OUTPUT_DIR/rapport.md" <<MARKDOWN
# BAG BUILD 2A.2 — geïsoleerde PostGIS-capaciteitsproef

- Gegevens: synthetisch, deterministisch volumeprofiel op basis van de Assen-dry-run
- Productiedatabase gebruikt: nee
- CRM-schrijfacties: nee
- Objecten: 128.745
- Voorkomens: 168.047
- Relaties: 212.738
- Geometrieën: 122.388
- Schemaduur: ${schema_seconden} seconden
- Laden en publiceren: ${load_seconden} seconden
- Totale duur: ${totaal_seconden} seconden
- Tabel- en indexopslag: ${totale_bytes} bytes
- Rollbacktest: geslaagd

## Tellingen

| Tabel | Rijen |
|---|---:|
$(awk -F '\t' '{printf "| %s | %s |\n", $1, $2}' "$OUTPUT_DIR/tellingen.tsv")

## Opslag per tabel

| Tabel | Tabelbytes | Indexbytes | Totaalbytes |
|---|---:|---:|---:|
$(awk -F '\t' '{printf "| %s | %s | %s | %s |\n", $1, $2, $3, $4}' "$OUTPUT_DIR/opslag.tsv")

## Interpretatiegrens

Deze proef meet schema-, constraint-, index-, publicatie- en rollbackgedrag bij het gemeten Assen-volume. De inhoud is synthetisch en bewijst nog niet dat de echte officiële XML-records zonder aanvullende mapping naar PostgreSQL kunnen worden geladen.
MARKDOWN

test -s "$OUTPUT_DIR/resultaat.json"
test -s "$OUTPUT_DIR/rapport.md"
test -s "$OUTPUT_DIR/queryplannen.txt"

echo "BUILD 2A.2-capaciteitsproef afgerond. Rapport: $OUTPUT_DIR/rapport.md"
