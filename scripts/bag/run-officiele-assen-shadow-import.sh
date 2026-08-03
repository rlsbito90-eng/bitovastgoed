#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_OFFICIAL_ASSEN_APPROVAL:?BAG_OFFICIAL_ASSEN_APPROVAL is verplicht}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPORT_DIR="${1:?Geef de map met de gevalideerde officiële Assen-export op}"
OUTPUT_DIR="${2:-$ROOT_DIR/bag-officiele-assen-shadow-import}"
IMPORT_SQL="$ROOT_DIR/experiments/bag/shadow/import-officiele-assen.sql"
EXPECTED_SHADOW_REF="xfygspvpeugxowxbcvnm"
PRODUCTION_REF="ljudxyrqoifhfikueric"
APPROVAL_PHRASE="APPLY_BAG_OFFICIAL_ASSEN_SHADOW"

fail() {
  echo "Weigering: $*" >&2
  exit 1
}

[[ "$BAG_OFFICIAL_ASSEN_APPROVAL" == "$APPROVAL_PHRASE" ]] \
  || fail 'onjuiste expliciete approval phrase.'
[[ "$BAG_SHADOW_PROJECT_REF" == "$EXPECTED_SHADOW_REF" ]] \
  || fail 'projectref is niet de bevestigde afgescheiden BAG-shadow.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$PRODUCTION_REF" ]] \
  || fail 'productieproject is altijd uitgesloten.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$PRODUCTION_REF"* ]] \
  || fail 'database-URL verwijst naar productie.'
[[ "$BAG_SHADOW_DATABASE_URL" == *"sslmode=require"* ]] \
  || fail 'database-URL moet sslmode=require bevatten.'

readarray -t database_identity < <(
  BAG_DATABASE_URL="$BAG_SHADOW_DATABASE_URL" node -e '
    const url = new URL(process.env.BAG_DATABASE_URL);
    console.log(url.hostname);
    console.log(decodeURIComponent(url.username));
  '
)
database_host="${database_identity[0]:-}"
database_user="${database_identity[1]:-}"
if [[ "$database_host" != *"$EXPECTED_SHADOW_REF"* \
   && "$database_user" != *".$EXPECTED_SHADOW_REF" ]]; then
  fail 'databasehost/gebruiker bevat de bevestigde shadowref niet.'
fi

command -v psql >/dev/null || fail 'psql ontbreekt.'
command -v node >/dev/null || fail 'node ontbreekt.'

EXPORT_DIR="$(realpath "$EXPORT_DIR")"
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(realpath "$OUTPUT_DIR")"

for bestand in \
  "$IMPORT_SQL" \
  "$EXPORT_DIR/objecten.csv" \
  "$EXPORT_DIR/voorkomens.csv" \
  "$EXPORT_DIR/relaties.csv" \
  "$EXPORT_DIR/geometrieen.csv" \
  "$EXPORT_DIR/manifest.json"; do
  [[ -s "$bestand" ]] || fail "ontbrekend of leeg bestand: $bestand"
done

manifest_value() {
  node -e "const m=require(process.argv[1]); const v=m[process.argv[2]]; if (!Number.isInteger(v)) process.exit(2); process.stdout.write(String(v))" \
    "$EXPORT_DIR/manifest.json" "$1"
}

expected_objecten="$(manifest_value objecten)"
expected_voorkomens="$(manifest_value voorkomens)"
expected_relaties="$(manifest_value relatiesUniek)"
expected_geometrieen="$(manifest_value geometrieen)"
manifest_checksum="$(sha256sum "$EXPORT_DIR/manifest.json" | awk '{print $1}')"
bron_checksum="${BAG_OFFICIAL_ASSEN_SOURCE_SHA256:?BAG_OFFICIAL_ASSEN_SOURCE_SHA256 is verplicht}"

[[ "$expected_objecten" == '128745' ]] || fail 'onverwacht aantal objecten.'
[[ "$expected_voorkomens" == '168047' ]] || fail 'onverwacht aantal voorkomens.'
[[ "$expected_relaties" == '160351' ]] || fail 'onverwacht aantal unieke relaties.'
[[ "$expected_geometrieen" == '122388' ]] || fail 'onverwacht aantal geometrieën.'
[[ "$bron_checksum" =~ ^[a-f0-9]{64}$ ]] || fail 'ongeldige SHA-256 van het officiële bronarchief.'
[[ "$EXPORT_DIR" =~ ^[A-Za-z0-9_./-]+$ ]] \
  || fail 'exportpad bevat tekens die niet veilig in het tijdelijke psql-script passen.'

generated_import_sql="$OUTPUT_DIR/import.generated.sql"
sed \
  -e "s|__OBJECTEN_CSV__|$EXPORT_DIR/objecten.csv|g" \
  -e "s|__VOORKOMENS_CSV__|$EXPORT_DIR/voorkomens.csv|g" \
  -e "s|__RELATIES_CSV__|$EXPORT_DIR/relaties.csv|g" \
  -e "s|__GEOMETRIEEN_CSV__|$EXPORT_DIR/geometrieen.csv|g" \
  "$IMPORT_SQL" >"$generated_import_sql"

if grep -q '__[A-Z_]*CSV__' "$generated_import_sql"; then
  fail 'niet alle lokale CSV-paden zijn ingevuld.'
fi

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' >"$OUTPUT_DIR/preflight.tsv"
SELECT current_database(), current_user;
SELECT count(*) FROM pg_catalog.pg_namespace
WHERE nspname IN ('bag_control', 'bag_staging', 'bag_published', 'bag_service');
SELECT count(*) FROM pg_catalog.pg_roles
WHERE rolname IN ('bag_loader', 'bag_publisher', 'bag_reader', 'bag_gateway');
SQL

mapfile -t preflight_lines <"$OUTPUT_DIR/preflight.tsv"
[[ "${#preflight_lines[@]}" == '3' ]] || fail 'onverwachte preflightuitvoer.'
[[ "${preflight_lines[0]}" == $'postgres\tpostgres' ]] \
  || fail 'verbinding gebruikt niet database en rol postgres.'
[[ "${preflight_lines[1]}" == '4' ]] || fail 'vereiste vier BAG-schema\047s ontbreken.'
[[ "${preflight_lines[2]}" == '4' ]] || fail 'vereiste vier BAG-rollen ontbreken.'

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v expected_objecten="$expected_objecten" \
  -v expected_voorkomens="$expected_voorkomens" \
  -v expected_relaties="$expected_relaties" \
  -v expected_geometrieen="$expected_geometrieen" \
  -v bron_checksum="$bron_checksum" \
  -v manifest_checksum="$manifest_checksum" \
  -f "$generated_import_sql" >"$OUTPUT_DIR/import.log" 2>&1

grep -q 'OFFICIELE_ASSEN_SHADOW_IMPORT_OK' "$OUTPUT_DIR/import.log" \
  || fail 'database-import gaf geen expliciete succesmarker.'

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' >"$OUTPUT_DIR/validatie.tsv"
SELECT 'dataset', id, datasetversie, scope_code, status, is_actief
FROM bag_control.datasetversies;
SELECT 'staging_objecten', count(*) FROM bag_staging.objecten;
SELECT 'staging_voorkomens', count(*) FROM bag_staging.voorkomens;
SELECT 'staging_relaties', count(*) FROM bag_staging.relaties;
SELECT 'staging_geometrieen', count(*) FROM bag_staging.geometrieen;
SELECT 'geometrie_afwijkingen', count(*) FROM bag_control.geometrie_afwijkingen;
SELECT 'published_objecten', count(*) FROM bag_published.objecten;
SELECT 'published_voorkomens', count(*) FROM bag_published.voorkomens;
SELECT 'published_relaties', count(*) FROM bag_published.relaties;
SELECT 'published_geometrieen', count(*) FROM bag_published.geometrieen;
SELECT 'postgres_set_true_memberships', count(*)
FROM pg_catalog.pg_auth_members AS m
JOIN pg_catalog.pg_roles AS granted ON granted.oid = m.roleid
JOIN pg_catalog.pg_roles AS member ON member.oid = m.member
WHERE member.rolname = 'postgres'
  AND granted.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
  AND m.set_option;
SELECT 'gateway_password_present', rolpassword IS NOT NULL
FROM pg_catalog.pg_authid WHERE rolname = 'bag_gateway';
SQL

grep -q $'^dataset\t[0-9]\+\tv20200601-officiele-assen-shadow\t0106\tactief\tt$' "$OUTPUT_DIR/validatie.tsv" \
  || fail 'dataset is niet exact actief voor scope 0106.'
grep -q $'^postgres_set_true_memberships\t0$' "$OUTPUT_DIR/validatie.tsv" \
  || fail 'tijdelijke SET TRUE-membership is achtergebleven.'
grep -q $'^gateway_password_present\tf$' "$OUTPUT_DIR/validatie.tsv" \
  || fail 'gateway-wachtwoord is onverwacht ingesteld.'

{
  echo '# Officiële Assen-import op BAG-shadow'
  echo
  echo "- Projectref: $EXPECTED_SHADOW_REF"
  echo '- Productie gebruikt: nee'
  echo '- Scope: 0106 (Assen)'
  echo "- Officiële bron SHA-256: \`$bron_checksum\`"
  echo "- Exportmanifest SHA-256: \`$manifest_checksum\`"
  echo '- Frontend feature flag gewijzigd: nee'
  echo
  echo '## Validatie'
  echo '```text'
  cat "$OUTPUT_DIR/validatie.tsv"
  echo '```'
} >"$OUTPUT_DIR/rapport.md"

echo "Officiële Assen-shadowimport groen: $OUTPUT_DIR/rapport.md"
