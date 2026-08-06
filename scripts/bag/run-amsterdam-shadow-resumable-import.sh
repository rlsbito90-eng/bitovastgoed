#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_AMSTERDAM_APPROVAL:?BAG_AMSTERDAM_APPROVAL is verplicht}"
: "${BAG_AMSTERDAM_ARTIFACT_ID:?BAG_AMSTERDAM_ARTIFACT_ID is verplicht}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPORT_DIR="$(realpath "${1:?Geef de map met het gevalideerde Amsterdam-importpakket op}")"
PHASE="${2:?Geef fase op: prepare|objecten|voorkomens|relaties|geometrieen|validate}"
OUTPUT_DIR="$(realpath -m "${3:-$ROOT_DIR/bag-amsterdam-resumable-import}")"
CHUNK_SIZE="${BAG_AMSTERDAM_CHUNK_SIZE:-50000}"
EXPECTED_SHADOW_REF="xfygspvpeugxowxbcvnm"
PRODUCTION_REF="ljudxyrqoifhfikueric"
CRM_SHADOW_REF="wzkhmjuasyuvzhhycnym"
APPROVAL_PHRASE="APPLY_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW"
DATASET_VERSION="v20260805"
SCOPE_CODE="0363"

EXPECTED_OBJECTEN=1464429
EXPECTED_VOORKOMENS_RAW=2664897
EXPECTED_VOORKOMENS=2664890
EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN=7
EXPECTED_RELATIES=2531300
EXPECTED_GEOMETRIEEN=1831720

fail() { echo "Weigering: $*" >&2; exit 1; }

[[ "$BAG_SHADOW_PROJECT_REF" == "$EXPECTED_SHADOW_REF" ]] || fail 'onjuiste projectref.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$PRODUCTION_REF" ]] || fail 'productie is uitgesloten.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$CRM_SHADOW_REF" ]] || fail 'CRM-shadow is uitgesloten.'
[[ "$BAG_AMSTERDAM_APPROVAL" == "$APPROVAL_PHRASE" ]] || fail 'onjuiste approval phrase.'
[[ "$BAG_AMSTERDAM_ARTIFACT_ID" == '8973886061' ]] || fail 'onjuist artifact-id.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$PRODUCTION_REF"* ]] || fail 'database-URL verwijst naar productie.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$CRM_SHADOW_REF"* ]] || fail 'database-URL verwijst naar CRM-shadow.'
[[ "$BAG_SHADOW_DATABASE_URL" == *"sslmode=require"* ]] || fail 'sslmode=require ontbreekt.'
[[ "$CHUNK_SIZE" =~ ^[1-9][0-9]*$ ]] || fail 'ongeldige chunkgrootte.'
command -v psql >/dev/null || fail 'psql ontbreekt.'
command -v split >/dev/null || fail 'split ontbreekt.'
command -v sha256sum >/dev/null || fail 'sha256sum ontbreekt.'
mkdir -p "$OUTPUT_DIR"

for f in importpakket-manifest.json objecten.csv voorkomens.csv relaties.csv geometrieen.csv; do
  [[ -s "$EXPORT_DIR/$f" ]] || fail "ontbrekend of leeg bestand: $f"
done

manifest_sha="$(sha256sum "$EXPORT_DIR/importpakket-manifest.json" | awk '{print $1}')"

dataset_id() {
  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
    "SELECT id FROM bag_control.datasetversies WHERE datasetversie='$DATASET_VERSION' AND scope_code='$SCOPE_CODE' ORDER BY id DESC LIMIT 1"
}

count_phase() {
  local table="$1" id="$2"
  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
    "SELECT count(*) FROM bag_staging.$table WHERE datasetversie_id=$id"
}

count_processed_phase() {
  local phase="$1" id="$2"
  if [[ "$phase" == 'geometrieen' ]]; then
    psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
      "SELECT
         (SELECT count(*) FROM bag_staging.geometrieen WHERE datasetversie_id=$id) +
         (SELECT count(*) FROM bag_control.geometrie_afwijkingen WHERE datasetversie_id=$id)"
  else
    count_phase "$phase" "$id"
  fi
}

write_preflight() {
  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' >"$OUTPUT_DIR/preflight.tsv"
SELECT current_database(), current_user;
SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname IN ('bag_control','bag_staging','bag_published','bag_service');
SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('bag_loader','bag_publisher','bag_reader','bag_gateway');
SELECT pg_database_size(current_database());
SQL
}

prepare() {
  write_preflight
  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
    -v manifest_sha="$manifest_sha" \
    -v artifact_id="$BAG_AMSTERDAM_ARTIFACT_ID" <<'SQL'
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE scope_code = '0363' AND datasetversie <> 'v20260805'
  ) THEN
    RAISE EXCEPTION 'Andere Amsterdam-datasetversie bestaat al.';
  END IF;
END
$guard$;

INSERT INTO bag_control.datasetversies (
  datasetversie, scope_code, status, is_actief, bron_checksum, bron_metadata
)
SELECT
  'v20260805', '0363', 'staging', false, :'manifest_sha',
  jsonb_build_object(
    'officieel', true,
    'bron', 'Kadaster landelijke BAG-selectie Amsterdam',
    'gemeentecode', '0363',
    'artifact_id', :'artifact_id',
    'importmodus', 'resumable_chunked_staging_only',
    'objecten_expected', 1464429,
    'voorkomens_bronregels_expected', 2664897,
    'voorkomens_identieke_duplicaten_expected', 7,
    'voorkomens_uniek_expected', 2664890,
    'relaties_expected', 2531300,
    'geometrieen_expected', 1831720
  )
WHERE NOT EXISTS (
  SELECT 1 FROM bag_control.datasetversies
  WHERE datasetversie='v20260805' AND scope_code='0363'
);
COMMIT;
SQL
  local id; id="$(dataset_id)"; [[ -n "$id" ]] || fail 'datasetrecord kon niet worden vastgesteld.'
  printf 'dataset_id=%s\nmanifest_sha256=%s\n' "$id" "$manifest_sha" >"$OUTPUT_DIR/rollback-marker.txt"
}

chunk_import() {
  local phase="$1" csv="$2" expected="$3"
  local id current tmpdir index chunk rows inserted deduplicated
  id="$(dataset_id)"; [[ -n "$id" ]] || fail 'voer eerst prepare uit.'
  current="$(count_processed_phase "$phase" "$id")"
  (( current <= expected )) || fail "$phase bevat meer verwerkte bronrijen dan verwacht."
  if (( current == expected )); then echo "$phase reeds compleet ($current verwerkte bronrijen)."; return 0; fi
  tmpdir="$OUTPUT_DIR/chunks-$phase"; rm -rf "$tmpdir"; mkdir -p "$tmpdir"
  tail -n "+$((current + 1))" "$csv" | split -l "$CHUNK_SIZE" -d -a 5 - "$tmpdir/chunk-"
  index=0
  for chunk in "$tmpdir"/chunk-*; do
    [[ -s "$chunk" ]] || continue
    rows="$(wc -l < "$chunk" | tr -d ' ')"
    echo "Importeer $phase chunk $index: $rows bronrijen vanaf $current"
    inserted="$rows"
    deduplicated=0
    case "$phase" in
      objecten)
        psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$id" <<SQL
BEGIN;
GRANT bag_loader TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_loader;
CREATE TEMP TABLE raw_chunk (objecttype text NOT NULL, identificatie text NOT NULL) ON COMMIT DROP;
\\copy raw_chunk FROM '$chunk' WITH (FORMAT csv)
INSERT INTO bag_staging.objecten (datasetversie_id, objecttype, identificatie)
SELECT :dataset_id, objecttype, identificatie FROM raw_chunk;
RESET ROLE;
REVOKE bag_loader FROM postgres GRANTED BY postgres;
COMMIT;
SQL
        ;;
      voorkomens)
        deduplicated="$(psql "$BAG_SHADOW_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -v dataset_id="$id" <<SQL
BEGIN;
GRANT bag_loader TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_loader;
CREATE TEMP TABLE raw_chunk (
 objecttype text NOT NULL, identificatie text NOT NULL, voorkomen_sleutel text NOT NULL,
 voorkomenidentificatie integer NOT NULL, is_actueel boolean NOT NULL,
 begin_geldigheid date, eind_geldigheid date, status text, velden jsonb NOT NULL
) ON COMMIT DROP;
\\copy raw_chunk FROM '$chunk' WITH (FORMAT csv)
DO \$guard\$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM raw_chunk
    GROUP BY objecttype, identificatie, voorkomen_sleutel
    HAVING count(*) > 1
       AND count(DISTINCT ROW(
         voorkomenidentificatie, is_actueel, begin_geldigheid,
         eind_geldigheid, status, velden
       )) > 1
  ) THEN
    RAISE EXCEPTION 'Conflicterende dubbele voorkomen-sleutel binnen chunk.';
  END IF;
END
\$guard\$;
CREATE TEMP TABLE deduped_chunk ON COMMIT DROP AS
SELECT DISTINCT ON (objecttype, identificatie, voorkomen_sleutel)
 objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 is_actueel, begin_geldigheid, eind_geldigheid, status, velden
FROM raw_chunk
ORDER BY objecttype, identificatie, voorkomen_sleutel;
INSERT INTO bag_staging.voorkomens (
 datasetversie_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 is_actueel, begin_geldigheid, eind_geldigheid, status, velden
)
SELECT :dataset_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 is_actueel, begin_geldigheid, eind_geldigheid, status, velden
FROM deduped_chunk;
SELECT (SELECT count(*) FROM raw_chunk) - (SELECT count(*) FROM deduped_chunk);
RESET ROLE;
REVOKE bag_loader FROM postgres GRANTED BY postgres;
COMMIT;
SQL
)"
        [[ "$deduplicated" =~ ^[0-9]+$ ]] || fail "ongeldige deduplicatietelling: $deduplicated"
        inserted=$((rows - deduplicated))
        if (( deduplicated > 0 )); then
          printf '%s\t%s\t%s\t%s\n' \
            "$phase" "$index" "$deduplicated" "$(date -u +%FT%TZ)" \
            >>"$OUTPUT_DIR/deduplicatie.tsv"
          echo "Sla $deduplicated volledig identieke dubbele voorkomens over."
        fi
        ;;
      relaties)
        psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$id" <<SQL
BEGIN;
GRANT bag_loader TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_loader;
CREATE TEMP TABLE raw_chunk (
 bron_objecttype text NOT NULL, bron_identificatie text NOT NULL,
 relatietype text NOT NULL, doel_identificatie text NOT NULL
) ON COMMIT DROP;
\\copy raw_chunk FROM '$chunk' WITH (FORMAT csv)
INSERT INTO bag_staging.relaties (
 datasetversie_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie
)
SELECT :dataset_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie FROM raw_chunk;
RESET ROLE;
REVOKE bag_loader FROM postgres GRANTED BY postgres;
COMMIT;
SQL
        ;;
      geometrieen)
        psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$id" <<SQL
BEGIN;
GRANT bag_loader TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_loader;
CREATE TEMP TABLE raw_chunk (
 objecttype text NOT NULL, identificatie text NOT NULL, voorkomen_sleutel text NOT NULL,
 voorkomenidentificatie integer NOT NULL, geometrie_volgnummer integer NOT NULL, wkt text NOT NULL
) ON COMMIT DROP;
\\copy raw_chunk FROM '$chunk' WITH (FORMAT csv)
CREATE TEMP TABLE assessed ON COMMIT DROP AS
SELECT *, extensions.st_force3d(extensions.st_geomfromtext(wkt,28992)) AS geometrie FROM raw_chunk;
INSERT INTO bag_control.geometrie_afwijkingen (
 datasetversie_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 geometrie_volgnummer, reden, wkt, bronmetadata
)
SELECT :dataset_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 geometrie_volgnummer, extensions.st_isvalidreason(geometrie), wkt,
 jsonb_build_object('bron','amsterdam_artifact_8973886061')
FROM assessed WHERE NOT extensions.st_isvalid(geometrie);
INSERT INTO bag_staging.geometrieen (
 datasetversie_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 geometrie_volgnummer, geometrie
)
SELECT :dataset_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
 geometrie_volgnummer, geometrie FROM assessed WHERE extensions.st_isvalid(geometrie);
RESET ROLE;
REVOKE bag_loader FROM postgres GRANTED BY postgres;
COMMIT;
SQL
        ;;
      *) fail "onbekende fase: $phase";;
    esac
    current=$((current + inserted)); index=$((index + 1))
    printf '%s\t%s\t%s\n' "$phase" "$current" "$(date -u +%FT%TZ)" >>"$OUTPUT_DIR/progress.tsv"
  done
  rm -rf "$tmpdir"
  current="$(count_processed_phase "$phase" "$id")"
  [[ "$current" == "$expected" ]] || fail "$phase eindtelling $current verwerkte bronrijen wijkt af van $expected."
  if [[ "$phase" == 'voorkomens' ]]; then
    local totaal_deduplicated
    totaal_deduplicated="$(awk -F '\t' '{s+=$3} END{print s+0}' "$OUTPUT_DIR/deduplicatie.tsv" 2>/dev/null || true)"
    [[ "$totaal_deduplicated" == "$EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN" ]] || \
      fail "verwacht $EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN identieke voorkomenduplicaten, aangetroffen $totaal_deduplicated."
  fi
}

validate() {
  local id; id="$(dataset_id)"; [[ -n "$id" ]] || fail 'dataset ontbreekt.'
  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' -v dataset_id="$id" <<'SQL' >"$OUTPUT_DIR/validatie.tsv"
SELECT 'dataset', datasetversie, scope_code, status, is_actief FROM bag_control.datasetversies WHERE id=:dataset_id;
SELECT 'objecten', count(*) FROM bag_staging.objecten WHERE datasetversie_id=:dataset_id;
SELECT 'voorkomens', count(*) FROM bag_staging.voorkomens WHERE datasetversie_id=:dataset_id;
SELECT 'relaties', count(*) FROM bag_staging.relaties WHERE datasetversie_id=:dataset_id;
SELECT 'geometrieen', count(*) FROM bag_staging.geometrieen WHERE datasetversie_id=:dataset_id;
SELECT 'geometrie_afwijkingen', count(*) FROM bag_control.geometrie_afwijkingen WHERE datasetversie_id=:dataset_id;
SELECT 'published_amsterdam', count(*) FROM bag_published.objecten WHERE datasetversie_id=:dataset_id;
SELECT 'actief_amsterdam', count(*) FROM bag_control.datasetversies WHERE id=:dataset_id AND is_actief;
SQL
  printf 'voorkomens_bronregels\t%s\n' "$EXPECTED_VOORKOMENS_RAW" >>"$OUTPUT_DIR/validatie.tsv"
  printf 'voorkomens_identieke_duplicaten\t%s\n' "$EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN" >>"$OUTPUT_DIR/validatie.tsv"
  printf 'voorkomens_uniek_expected\t%s\n' "$EXPECTED_VOORKOMENS" >>"$OUTPUT_DIR/validatie.tsv"
  grep -q $'^objecten\t1464429$' "$OUTPUT_DIR/validatie.tsv" || fail 'objecttelling niet groen.'
  grep -q $'^voorkomens\t2664890$' "$OUTPUT_DIR/validatie.tsv" || fail 'voorkomentelling niet groen.'
  grep -q $'^relaties\t2531300$' "$OUTPUT_DIR/validatie.tsv" || fail 'relatietelling niet groen.'
  local geom valid invalid
  valid="$(awk -F '\t' '$1=="geometrieen"{print $2}' "$OUTPUT_DIR/validatie.tsv")"
  invalid="$(awk -F '\t' '$1=="geometrie_afwijkingen"{print $2}' "$OUTPUT_DIR/validatie.tsv")"
  geom=$((valid + invalid)); [[ "$geom" == "$EXPECTED_GEOMETRIEEN" ]] || fail 'geometrietelling niet groen.'
  grep -q $'^published_amsterdam\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'Amsterdam is onverwacht gepubliceerd.'
  grep -q $'^actief_amsterdam\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'Amsterdam is onverwacht actief.'
  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$id" -c \
    "UPDATE bag_control.datasetversies
     SET status='gevalideerd',
         gevalideerd_op=clock_timestamp(),
         bron_metadata=bron_metadata || jsonb_build_object(
           'voorkomens_bronregels', $EXPECTED_VOORKOMENS_RAW,
           'voorkomens_identieke_duplicaten', $EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN,
           'voorkomens_uniek', $EXPECTED_VOORKOMENS
         )
     WHERE id=:dataset_id AND status='staging' AND NOT is_actief;"
  {
    echo '# Amsterdam resumable staging-import'
    echo
    echo "- Projectref: $EXPECTED_SHADOW_REF"
    echo '- Productie gebruikt: nee'
    echo '- CRM-shadow gebruikt: nee'
    echo '- Gepubliceerd: nee'
    echo '- Geactiveerd: nee'
    echo '- Status: gevalideerd'
    echo "- Voorkomens bronregels: $EXPECTED_VOORKOMENS_RAW"
    echo "- Identieke voorkomenduplicaten overgeslagen: $EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN"
    echo "- Unieke voorkomens: $EXPECTED_VOORKOMENS"
    echo
    echo '```text'; cat "$OUTPUT_DIR/validatie.tsv"; echo '```'
  } >"$OUTPUT_DIR/rapport.md"
}

case "$PHASE" in
  prepare) prepare ;;
  objecten) chunk_import objecten "$EXPORT_DIR/objecten.csv" "$EXPECTED_OBJECTEN" ;;
  voorkomens) chunk_import voorkomens "$EXPORT_DIR/voorkomens.csv" "$EXPECTED_VOORKOMENS" ;;
  relaties) chunk_import relaties "$EXPORT_DIR/relaties.csv" "$EXPECTED_RELATIES" ;;
  geometrieen) chunk_import geometrieen "$EXPORT_DIR/geometrieen.csv" "$EXPECTED_GEOMETRIEEN" ;;
  validate) validate ;;
  *) fail 'fase moet prepare|objecten|voorkomens|relaties|geometrieen|validate zijn.' ;;
esac

echo "AMSTERDAM_RESUMABLE_PHASE_OK phase=$PHASE"
