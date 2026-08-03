#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is verplicht en moet naar de tijdelijke testdatabase wijzen}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPORT_DIR="${1:?Geef de map met officiële Assen-CSV-bestanden op}"
OUTPUT_DIR="${2:-$ROOT_DIR/bag-2a2-officiele-assen-proef}"
SCHEMA_SQL="$ROOT_DIR/experiments/bag/2a2/schema.sql"
LOAD_SQL="$ROOT_DIR/experiments/bag/2a2/load-officiele-assen.sql"

mkdir -p "$OUTPUT_DIR"
EXPORT_DIR="$(realpath "$EXPORT_DIR")"
OUTPUT_DIR="$(realpath "$OUTPUT_DIR")"

if [[ "$DATABASE_URL" != *"localhost"* && "$DATABASE_URL" != *"127.0.0.1"* ]]; then
  echo "Weigering: de officiële Assen-proef mag uitsluitend tegen een lokale tijdelijke database draaien." >&2
  exit 1
fi

for bestand in "$SCHEMA_SQL" "$LOAD_SQL" \
  "$EXPORT_DIR/objecten.csv" "$EXPORT_DIR/voorkomens.csv" \
  "$EXPORT_DIR/relaties.csv" "$EXPORT_DIR/geometrieen.csv" "$EXPORT_DIR/manifest.json"; do
  test -s "$bestand"
done

expected_relations="$(node -e "const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(m.relatiesUniek))" "$EXPORT_DIR/manifest.json")"
expected_geometries="$(node -e "const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(m.geometrieen))" "$EXPORT_DIR/manifest.json")"
bron_checksum="$(sha256sum "$EXPORT_DIR/manifest.json" | awk '{print $1}')"

copy_sql="$OUTPUT_DIR/copy.sql"
cat >"$copy_sql" <<SQL
\\set ON_ERROR_STOP on
SET search_path TO bag_experiment, public;
\\copy raw_objecten(objecttype, identificatie) FROM '$EXPORT_DIR/objecten.csv' WITH (FORMAT csv)
\\copy raw_voorkomens(objecttype, identificatie, voorkomenidentificatie, is_actueel, begin_geldigheid, eind_geldigheid, status, velden) FROM '$EXPORT_DIR/voorkomens.csv' WITH (FORMAT csv)
\\copy raw_relaties(bron_objecttype, bron_identificatie, relatietype, doel_identificatie) FROM '$EXPORT_DIR/relaties.csv' WITH (FORMAT csv)
\\copy raw_geometrieen(objecttype, identificatie, voorkomenidentificatie, wkt) FROM '$EXPORT_DIR/geometrieen.csv' WITH (FORMAT csv)
SQL

start_epoch="$(date +%s)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL" >"$OUTPUT_DIR/schema.log" 2>&1
schema_epoch="$(date +%s)"

awk '/^INSERT INTO datasetversies/{exit} {print}' "$LOAD_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >"$OUTPUT_DIR/raw-schema.log" 2>&1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$copy_sql" >"$OUTPUT_DIR/copy.log" 2>&1
awk 'BEGIN{start=0} /^INSERT INTO datasetversies/{start=1} start{print}' "$LOAD_SQL" | \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v bron_checksum="$bron_checksum" \
    -v expected_relations="$expected_relations" \
    -v expected_geometries="$expected_geometries" \
    >"$OUTPUT_DIR/load.log" 2>&1
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
SELECT c.relname, pg_relation_size(c.oid), pg_indexes_size(c.oid), pg_total_relation_size(c.oid)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'bag_experiment' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC, c.relname;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At <<'SQL' >"$OUTPUT_DIR/queryplannen.txt"
SET search_path TO bag_experiment, public;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT identificatie
FROM geometrieen
WHERE geometrie && ST_MakeEnvelope(230000, 550000, 240000, 560000, 28992)
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT identificatie, status
FROM voorkomens
WHERE objecttype = 'Pand' AND is_actueel = true
LIMIT 100;
SQL

rollback_voor="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT status || ':' || is_actief FROM bag_experiment.datasetversies WHERE datasetversie='v20200601-officiele-assen-proef'")"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' >"$OUTPUT_DIR/rollback.log" 2>&1
BEGIN;
UPDATE bag_experiment.datasetversies
SET status = 'vervangen', is_actief = false
WHERE datasetversie = 'v20200601-officiele-assen-proef';
ROLLBACK;
SQL
rollback_na="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT status || ':' || is_actief FROM bag_experiment.datasetversies WHERE datasetversie='v20200601-officiele-assen-proef'")"
test "$rollback_voor" = "$rollback_na"

schema_seconden=$((schema_epoch - start_epoch))
load_seconden=$((load_epoch - schema_epoch))
totaal_seconden=$((load_epoch - start_epoch))
totale_bytes="$(awk -F '\t' '{som += $4} END {printf "%.0f", som}' "$OUTPUT_DIR/opslag.tsv")"

cat >"$OUTPUT_DIR/resultaat.json" <<JSON
{
  "experiment": "BAG BUILD 2A.2 officiële Assen PostGIS-laadproef",
  "gegevens": "officiële Assen XML via bestaande adapter en staginglaag",
  "productiedatabaseGebruikt": false,
  "crmSchrijfacties": false,
  "volume": {
    "objecten": 128745,
    "voorkomens": 168047,
    "relaties": $expected_relations,
    "geometrieen": $expected_geometries
  },
  "duurSeconden": {
    "schema": $schema_seconden,
    "exportKopierenLadenEnPubliceren": $load_seconden,
    "totaalDatabase": $totaal_seconden
  },
  "totaleTabelEnIndexBytes": $totale_bytes,
  "rollbackBehouden": true,
  "bronManifestSha256": "$bron_checksum"
}
JSON

cat >"$OUTPUT_DIR/rapport.md" <<MARKDOWN
# BAG BUILD 2A.2 — officiële Assen PostGIS-laadproef

- Gegevens: officiële Assen XML via de bestaande adapter en staginglaag
- Productiedatabase gebruikt: nee
- CRM-schrijfacties: nee
- Objecten: 128.745
- Voorkomens: 168.047
- Unieke relaties: ${expected_relations}
- Geldige geëxporteerde geometrieën: ${expected_geometries}
- Schemaduur: ${schema_seconden} seconden
- Kopiëren, laden, valideren en publiceren: ${load_seconden} seconden
- Totale databaseduur: ${totaal_seconden} seconden
- Tabel- en indexopslag: ${totale_bytes} bytes
- Rollbacktest: geslaagd
- Bronmanifest SHA-256: \`${bron_checksum}\`

## Tellingen

| Tabel | Rijen |
|---|---:|
$(awk -F '\t' '$1 != "SET" {printf "| %s | %s |\n", $1, $2}' "$OUTPUT_DIR/tellingen.tsv")

## Opslag per tabel

| Tabel | Tabelbytes | Indexbytes | Totaalbytes |
|---|---:|---:|---:|
$(awk -F '\t' '{printf "| %s | %s | %s | %s |\n", $1, $2, $3, $4}' "$OUTPUT_DIR/opslag.tsv")

## Interpretatiegrens

Deze proef gebruikt echte officiële Assen-records, maar uitsluitend in een tijdelijke lokale PostGIS-container. Zij bewijst nog geen veilige productie-import, landelijke schaal of Supabase-specifiek RLS- en lockgedrag.
MARKDOWN

cp "$EXPORT_DIR/manifest.json" "$OUTPUT_DIR/export-manifest.json"
test -s "$OUTPUT_DIR/resultaat.json"
test -s "$OUTPUT_DIR/rapport.md"
test -s "$OUTPUT_DIR/queryplannen.txt"

echo "Officiële Assen PostGIS-laadproef afgerond. Rapport: $OUTPUT_DIR/rapport.md"
