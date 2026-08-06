#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_AMSTERDAM_APPROVAL:?BAG_AMSTERDAM_APPROVAL is verplicht}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPORT_DIR="${1:?Geef de uitgepakte importpakket-map op}"
OUTPUT_DIR="${2:-$ROOT_DIR/bag-amsterdam-shadow-import-resultaat}"
IMPORT_SQL="$ROOT_DIR/experiments/bag/shadow/import-amsterdam-staging.sql"
EXPECTED_SHADOW_REF="xfygspvpeugxowxbcvnm"
PRODUCTION_REF="ljudxyrqoifhfikueric"
CRM_SHADOW_REF="wzkhmjuasyuvzhhycnym"
APPROVAL_PHRASE="APPLY_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW"
EXPECTED_ARTIFACT_ID="8973886061"

fail() { echo "Weigering: $*" >&2; exit 1; }

[[ "$BAG_AMSTERDAM_APPROVAL" == "$APPROVAL_PHRASE" ]] || fail 'onjuiste expliciete approval phrase.'
[[ "$BAG_SHADOW_PROJECT_REF" == "$EXPECTED_SHADOW_REF" ]] || fail 'projectref is niet de bevestigde BAG-shadow.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$PRODUCTION_REF" ]] || fail 'productieproject is altijd uitgesloten.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$CRM_SHADOW_REF" ]] || fail 'CRM-shadow is altijd uitgesloten.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$PRODUCTION_REF"* ]] || fail 'database-URL verwijst naar productie.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$CRM_SHADOW_REF"* ]] || fail 'database-URL verwijst naar CRM-shadow.'
[[ "$BAG_SHADOW_DATABASE_URL" == *"sslmode=require"* ]] || fail 'database-URL moet sslmode=require bevatten.'

readarray -t database_identity < <(
  BAG_DATABASE_URL="$BAG_SHADOW_DATABASE_URL" node -e '
    const url = new URL(process.env.BAG_DATABASE_URL);
    console.log(url.hostname);
    console.log(decodeURIComponent(url.username));
  '
)
database_host="${database_identity[0]:-}"
database_user="${database_identity[1]:-}"
if [[ "$database_host" != *"$EXPECTED_SHADOW_REF"* && "$database_user" != *".$EXPECTED_SHADOW_REF" ]]; then
  fail 'databasehost/gebruiker bevat de bevestigde shadowref niet.'
fi

command -v psql >/dev/null || fail 'psql ontbreekt.'
command -v node >/dev/null || fail 'node ontbreekt.'
command -v sha256sum >/dev/null || fail 'sha256sum ontbreekt.'

EXPORT_DIR="$(realpath "$EXPORT_DIR")"
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(realpath "$OUTPUT_DIR")"
MANIFEST="$EXPORT_DIR/importpakket-manifest.json"

for bestand in "$IMPORT_SQL" "$MANIFEST" \
  "$EXPORT_DIR/objecten.csv" "$EXPORT_DIR/voorkomens.csv" \
  "$EXPORT_DIR/relaties.csv" "$EXPORT_DIR/geometrieen.csv"; do
  [[ -s "$bestand" ]] || fail "ontbrekend of leeg bestand: $bestand"
done

node - "$MANIFEST" "$EXPECTED_ARTIFACT_ID" <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const expectedArtifact = Number(process.argv[3]);
if (manifest.contractversie !== 'bag-amsterdam-importpakket/1') throw new Error('onjuist contract');
if (manifest.datasetVersie !== 'v20260805') throw new Error('onjuiste datasetversie');
if (manifest.scopeCode !== '0363') throw new Error('onjuiste scope');
if (manifest.besluit !== 'GO') throw new Error('importbesluit is geen GO');
if (manifest.databaseImportUitgevoerd !== false) throw new Error('pakket claimt al een database-import');
if (manifest.quarantaine !== 0 || manifest.stopCondities.length !== 0) throw new Error('quarantaine of stopcondities aanwezig');
if (expectedArtifact !== 8973886061) throw new Error('onverwacht artifact-id');
NODE

manifest_field() {
  node -e "const m=require(process.argv[1]); const p=process.argv[2].split('.'); let v=m; for (const k of p) v=v[k]; process.stdout.write(String(v));" "$MANIFEST" "$1"
}

expected_objecten="$(manifest_field tellingen.objecten)"
expected_voorkomens="$(manifest_field tellingen.voorkomens)"
expected_relaties="$(manifest_field tellingen.relatiesUniek)"
expected_geometrieen="$(manifest_field tellingen.geometrieen)"
bron_checksum="$(manifest_field bronSha256)"
manifest_checksum="$(sha256sum "$MANIFEST" | awk '{print $1}')"

[[ "$expected_objecten" == '1464429' ]] || fail 'onverwacht aantal objecten.'
[[ "$expected_voorkomens" == '2664897' ]] || fail 'onverwacht aantal voorkomens.'
[[ "$expected_relaties" == '2531300' ]] || fail 'onverwacht aantal relaties.'
[[ "$expected_geometrieen" == '1831720' ]] || fail 'onverwacht aantal geometrieën.'
[[ "$bron_checksum" =~ ^[a-f0-9]{64}$ ]] || fail 'ongeldige bron-SHA-256.'

node - "$MANIFEST" "$EXPORT_DIR" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = process.argv[3];
for (const entry of manifest.bestanden) {
  if (!entry.bestand.endsWith('.csv')) continue;
  const p = path.join(dir, entry.bestand);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if (hash !== entry.sha256) throw new Error(`checksum mismatch: ${entry.bestand}`);
}
NODE

[[ "$EXPORT_DIR" =~ ^[A-Za-z0-9_./-]+$ ]] || fail 'exportpad bevat onveilige tekens.'
generated_import_sql="$OUTPUT_DIR/import.generated.sql"
sed -e "s|__OBJECTEN_CSV__|$EXPORT_DIR/objecten.csv|g" \
  -e "s|__VOORKOMENS_CSV__|$EXPORT_DIR/voorkomens.csv|g" \
  -e "s|__RELATIES_CSV__|$EXPORT_DIR/relaties.csv|g" \
  -e "s|__GEOMETRIEEN_CSV__|$EXPORT_DIR/geometrieen.csv|g" \
  "$IMPORT_SQL" > "$generated_import_sql"
grep -q '__[A-Z_]*CSV__' "$generated_import_sql" && fail 'niet alle CSV-paden zijn ingevuld.'

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' > "$OUTPUT_DIR/preflight.tsv"
SELECT current_database(), current_user;
SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname IN ('bag_control','bag_staging','bag_published','bag_service');
SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('bag_loader','bag_publisher','bag_reader','bag_gateway');
SELECT coalesce(string_agg(datasetversie || ':' || scope_code || ':' || status || ':' || is_actief, ',' ORDER BY id), 'geen')
FROM bag_control.datasetversies;
SQL

mapfile -t preflight_lines < "$OUTPUT_DIR/preflight.tsv"
[[ "${#preflight_lines[@]}" == '4' ]] || fail 'onverwachte preflightuitvoer.'
[[ "${preflight_lines[0]}" == $'postgres\tpostgres' ]] || fail 'verbinding gebruikt niet postgres/postgres.'
[[ "${preflight_lines[1]}" == '4' ]] || fail 'vereiste vier BAG-schema’s ontbreken.'
[[ "${preflight_lines[2]}" == '4' ]] || fail 'vereiste vier BAG-rollen ontbreken.'
printf '%s\n' "artifact=$EXPECTED_ARTIFACT_ID" "project=$EXPECTED_SHADOW_REF" "datasets_voor=${preflight_lines[3]}" > "$OUTPUT_DIR/rollback-marker.txt"

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v expected_objecten="$expected_objecten" \
  -v expected_voorkomens="$expected_voorkomens" \
  -v expected_relaties="$expected_relaties" \
  -v expected_geometrieen="$expected_geometrieen" \
  -v bron_checksum="$bron_checksum" \
  -v manifest_checksum="$manifest_checksum" \
  -f "$generated_import_sql" > "$OUTPUT_DIR/import.log" 2>&1

grep -q 'AMSTERDAM_SHADOW_STAGING_IMPORT_OK' "$OUTPUT_DIR/import.log" || fail 'geen expliciete succesmarker.'

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' > "$OUTPUT_DIR/validatie.tsv"
SELECT 'dataset', id, datasetversie, scope_code, status, is_actief
FROM bag_control.datasetversies WHERE datasetversie='v20260805' AND scope_code='0363';
SELECT 'staging_objecten', count(*) FROM bag_staging.objecten o JOIN bag_control.datasetversies d ON d.id=o.datasetversie_id WHERE d.datasetversie='v20260805' AND d.scope_code='0363';
SELECT 'staging_voorkomens', count(*) FROM bag_staging.voorkomens o JOIN bag_control.datasetversies d ON d.id=o.datasetversie_id WHERE d.datasetversie='v20260805' AND d.scope_code='0363';
SELECT 'staging_relaties', count(*) FROM bag_staging.relaties o JOIN bag_control.datasetversies d ON d.id=o.datasetversie_id WHERE d.datasetversie='v20260805' AND d.scope_code='0363';
SELECT 'staging_geometrieen', count(*) FROM bag_staging.geometrieen o JOIN bag_control.datasetversies d ON d.id=o.datasetversie_id WHERE d.datasetversie='v20260805' AND d.scope_code='0363';
SELECT 'geometrie_afwijkingen', count(*) FROM bag_control.geometrie_afwijkingen o JOIN bag_control.datasetversies d ON d.id=o.datasetversie_id WHERE d.datasetversie='v20260805' AND d.scope_code='0363';
SELECT 'published_amsterdam', count(*) FROM bag_published.objecten o JOIN bag_control.datasetversies d ON d.id=o.datasetversie_id WHERE d.datasetversie='v20260805' AND d.scope_code='0363';
SQL

grep -q $'^dataset\t[0-9]\+\tv20260805\t0363\tstaging\tf$' "$OUTPUT_DIR/validatie.tsv" || fail 'Amsterdam staat niet exact als inactieve stagingdataset geregistreerd.'
grep -q $'^staging_objecten\t1464429$' "$OUTPUT_DIR/validatie.tsv" || fail 'objecttelling wijkt af.'
grep -q $'^staging_voorkomens\t2664897$' "$OUTPUT_DIR/validatie.tsv" || fail 'voorkomentelling wijkt af.'
grep -q $'^staging_relaties\t2531300$' "$OUTPUT_DIR/validatie.tsv" || fail 'relatietelling wijkt af.'
grep -q $'^staging_geometrieen\t1831720$' "$OUTPUT_DIR/validatie.tsv" || fail 'geometrietelling wijkt af.'
grep -q $'^geometrie_afwijkingen\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'geometrieafwijkingen zijn niet nul.'
grep -q $'^published_amsterdam\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'Amsterdam is onverwacht gepubliceerd.'

{
  echo '# Amsterdam staging-import op BAG-shadow'
  echo
  echo "- Artifact: $EXPECTED_ARTIFACT_ID"
  echo "- Projectref: $EXPECTED_SHADOW_REF"
  echo '- Productie gebruikt: nee'
  echo '- CRM-shadow gebruikt: nee'
  echo '- Scope: 0363 (Amsterdam)'
  echo '- Publicatie/activatie: niet uitgevoerd'
  echo "- Bron SHA-256: \`$bron_checksum\`"
  echo "- Importmanifest SHA-256: \`$manifest_checksum\`"
  echo
  echo '## Validatie'
  echo '```text'
  cat "$OUTPUT_DIR/validatie.tsv"
  echo '```'
} > "$OUTPUT_DIR/rapport.md"

echo "Amsterdam staging-import groen: $OUTPUT_DIR/rapport.md"
