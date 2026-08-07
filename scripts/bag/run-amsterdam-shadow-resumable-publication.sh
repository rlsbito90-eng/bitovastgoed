#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_AMSTERDAM_PUBLICATION_APPROVAL:?BAG_AMSTERDAM_PUBLICATION_APPROVAL is verplicht}"

PHASE="${1:?Geef fase op: objecten|voorkomens|relaties|geometrieen|validate}"
OUTPUT_DIR="$(realpath -m "${2:-bag-amsterdam-resumable-publication}")"
CHUNK_SIZE="${BAG_AMSTERDAM_PUBLICATION_CHUNK_SIZE:-50000}"

EXPECTED_SHADOW_REF="xfygspvpeugxowxbcvnm"
PRODUCTION_REF="ljudxyrqoifhfikueric"
CRM_SHADOW_REF="wzkhmjuasyuvzhhycnym"
APPROVAL_PHRASE="PUBLISH_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW"
DATASET_ID=2
DATASET_VERSION="v20260805"
SCOPE_CODE="0363"
EXPECTED_OBJECTEN=1464429
EXPECTED_VOORKOMENS=2664890
EXPECTED_RELATIES=2531300
EXPECTED_GEOMETRIEEN=1830704
EXPECTED_GEOMETRIE_AFWIJKINGEN=1016

fail() { echo "Weigering: $*" >&2; exit 1; }

[[ "$BAG_SHADOW_PROJECT_REF" == "$EXPECTED_SHADOW_REF" ]] || fail 'onjuiste projectref.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$PRODUCTION_REF" ]] || fail 'productie is uitgesloten.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$CRM_SHADOW_REF" ]] || fail 'CRM-shadow is uitgesloten.'
[[ "$BAG_AMSTERDAM_PUBLICATION_APPROVAL" == "$APPROVAL_PHRASE" ]] || fail 'onjuiste publication approval phrase.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$PRODUCTION_REF"* ]] || fail 'database-URL verwijst naar productie.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$CRM_SHADOW_REF"* ]] || fail 'database-URL verwijst naar CRM-shadow.'
[[ "$BAG_SHADOW_DATABASE_URL" == *"sslmode=require"* ]] || fail 'sslmode=require ontbreekt.'
[[ "$CHUNK_SIZE" =~ ^[1-9][0-9]*$ ]] || fail 'ongeldige chunkgrootte.'
case "$PHASE" in objecten|voorkomens|relaties|geometrieen|validate) ;; *) fail 'onbekende fase.';; esac
command -v psql >/dev/null || fail 'psql ontbreekt.'
mkdir -p "$OUTPUT_DIR"

psql_scalar() {
  psql "$BAG_SHADOW_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "$1"
}

assert_dataset_guard() {
  local row
  row="$(psql_scalar "SELECT id || E'\\t' || datasetversie || E'\\t' || scope_code || E'\\t' || status || E'\\t' || is_actief FROM bag_control.datasetversies WHERE id=$DATASET_ID")"
  [[ "$row" == $'2\tv20260805\t0363\tgevalideerd\tfalse' ]] || fail "Amsterdam datasetguard faalde: $row"
  [[ "$(psql_scalar "SELECT count(*) FROM bag_control.datasetversies WHERE scope_code='0106' AND status='actief' AND is_actief")" == '1' ]] || fail 'Assen is niet exact eenmaal actief.'
  [[ "$(psql_scalar "SELECT count(*) FROM bag_control.datasetversies WHERE scope_code='0363' AND is_actief")" == '0' ]] || fail 'Amsterdam is onverwacht actief.'
  [[ "$(psql_scalar "SELECT count(*) FROM bag_control.geometrie_afwijkingen WHERE datasetversie_id=$DATASET_ID")" == "$EXPECTED_GEOMETRIE_AFWIJKINGEN" ]] || fail 'Amsterdam geometriequarantaine wijkt af.'
}

count_published() {
  local table="$1"
  psql_scalar "SELECT count(*) FROM bag_published.$table WHERE datasetversie_id=$DATASET_ID"
}

assert_staging_counts() {
  [[ "$(psql_scalar "SELECT count(*) FROM bag_staging.objecten WHERE datasetversie_id=$DATASET_ID")" == "$EXPECTED_OBJECTEN" ]] || fail 'staging objecten wijkt af.'
  [[ "$(psql_scalar "SELECT count(*) FROM bag_staging.voorkomens WHERE datasetversie_id=$DATASET_ID")" == "$EXPECTED_VOORKOMENS" ]] || fail 'staging voorkomens wijkt af.'
  [[ "$(psql_scalar "SELECT count(*) FROM bag_staging.relaties WHERE datasetversie_id=$DATASET_ID")" == "$EXPECTED_RELATIES" ]] || fail 'staging relaties wijkt af.'
  [[ "$(psql_scalar "SELECT count(*) FROM bag_staging.geometrieen WHERE datasetversie_id=$DATASET_ID")" == "$EXPECTED_GEOMETRIEEN" ]] || fail 'staging geometrieen wijkt af.'
}

assert_phase_order() {
  local o v r g
  o="$(count_published objecten)"; v="$(count_published voorkomens)"; r="$(count_published relaties)"; g="$(count_published geometrieen)"
  case "$PHASE" in
    objecten)
      (( o <= EXPECTED_OBJECTEN )) || fail 'published objecten boven verwachting.'
      [[ "$v" == '0' && "$r" == '0' && "$g" == '0' ]] || fail 'latere publicationfase is al gevuld.'
      ;;
    voorkomens)
      [[ "$o" == "$EXPECTED_OBJECTEN" ]] || fail 'objecten-publicatie is niet compleet.'
      (( v <= EXPECTED_VOORKOMENS )) || fail 'published voorkomens boven verwachting.'
      [[ "$r" == '0' && "$g" == '0' ]] || fail 'latere publicationfase is al gevuld.'
      ;;
    relaties)
      [[ "$o" == "$EXPECTED_OBJECTEN" && "$v" == "$EXPECTED_VOORKOMENS" ]] || fail 'objecten/voorkomens-publicatie is niet compleet.'
      (( r <= EXPECTED_RELATIES )) || fail 'published relaties boven verwachting.'
      [[ "$g" == '0' ]] || fail 'geometriepublicatie is al gestart.'
      ;;
    geometrieen)
      [[ "$o" == "$EXPECTED_OBJECTEN" && "$v" == "$EXPECTED_VOORKOMENS" && "$r" == "$EXPECTED_RELATIES" ]] || fail 'voorafgaande publicationfasen zijn niet compleet.'
      (( g <= EXPECTED_GEOMETRIEEN )) || fail 'published geometrieen boven verwachting.'
      ;;
    validate)
      [[ "$o" == "$EXPECTED_OBJECTEN" && "$v" == "$EXPECTED_VOORKOMENS" && "$r" == "$EXPECTED_RELATIES" && "$g" == "$EXPECTED_GEOMETRIEEN" ]] || fail 'publication is nog niet compleet.'
      ;;
  esac
}

write_preflight() {
  psql "$BAG_SHADOW_DATABASE_URL" -X -qAt -F $'\t' -v ON_ERROR_STOP=1 <<SQL >"$OUTPUT_DIR/preflight.tsv"
SELECT 'database', current_database(), current_user, pg_database_size(current_database());
SELECT 'dataset', id, datasetversie, scope_code, status, is_actief FROM bag_control.datasetversies WHERE id=$DATASET_ID;
SELECT 'assen_actief', count(*) FROM bag_control.datasetversies WHERE scope_code='0106' AND status='actief' AND is_actief;
SELECT 'published_objecten', count(*) FROM bag_published.objecten WHERE datasetversie_id=$DATASET_ID;
SELECT 'published_voorkomens', count(*) FROM bag_published.voorkomens WHERE datasetversie_id=$DATASET_ID;
SELECT 'published_relaties', count(*) FROM bag_published.relaties WHERE datasetversie_id=$DATASET_ID;
SELECT 'published_geometrieen', count(*) FROM bag_published.geometrieen WHERE datasetversie_id=$DATASET_ID;
SQL
}

publish_chunk() {
  local phase="$1"
  case "$phase" in
    objecten)
      psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$DATASET_ID" -v chunk_size="$CHUNK_SIZE" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='110s';
SET LOCAL lock_timeout='5s';
GRANT bag_publisher TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_publisher;
WITH last_key AS (
  SELECT objecttype, identificatie
  FROM bag_published.objecten WHERE datasetversie_id=:dataset_id
  ORDER BY objecttype DESC, identificatie DESC LIMIT 1
), next_rows AS (
  SELECT s.objecttype, s.identificatie
  FROM bag_staging.objecten s LEFT JOIN last_key l ON true
  WHERE s.datasetversie_id=:dataset_id
    AND (l.objecttype IS NULL OR (s.objecttype,s.identificatie) > (l.objecttype,l.identificatie))
  ORDER BY s.objecttype, s.identificatie LIMIT :chunk_size
)
INSERT INTO bag_published.objecten (datasetversie_id, objecttype, identificatie)
SELECT :dataset_id, objecttype, identificatie FROM next_rows;
RESET ROLE;
REVOKE bag_publisher FROM postgres GRANTED BY postgres;
COMMIT;
SQL
      ;;
    voorkomens)
      psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$DATASET_ID" -v chunk_size="$CHUNK_SIZE" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='110s';
SET LOCAL lock_timeout='5s';
GRANT bag_publisher TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_publisher;
WITH last_key AS (
  SELECT objecttype, identificatie, voorkomen_sleutel
  FROM bag_published.voorkomens WHERE datasetversie_id=:dataset_id
  ORDER BY objecttype DESC, identificatie DESC, voorkomen_sleutel DESC LIMIT 1
), next_rows AS (
  SELECT s.objecttype, s.identificatie, s.voorkomen_sleutel, s.voorkomenidentificatie,
         s.is_actueel, s.begin_geldigheid, s.eind_geldigheid, s.status, s.velden
  FROM bag_staging.voorkomens s LEFT JOIN last_key l ON true
  WHERE s.datasetversie_id=:dataset_id
    AND (l.objecttype IS NULL OR (s.objecttype,s.identificatie,s.voorkomen_sleutel) > (l.objecttype,l.identificatie,l.voorkomen_sleutel))
  ORDER BY s.objecttype, s.identificatie, s.voorkomen_sleutel LIMIT :chunk_size
)
INSERT INTO bag_published.voorkomens (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
  is_actueel, begin_geldigheid, eind_geldigheid, status, velden
)
SELECT :dataset_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
       is_actueel, begin_geldigheid, eind_geldigheid, status, velden FROM next_rows;
RESET ROLE;
REVOKE bag_publisher FROM postgres GRANTED BY postgres;
COMMIT;
SQL
      ;;
    relaties)
      psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$DATASET_ID" -v chunk_size="$CHUNK_SIZE" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='110s';
SET LOCAL lock_timeout='5s';
GRANT bag_publisher TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_publisher;
WITH last_key AS (
  SELECT bron_objecttype, bron_identificatie, relatietype, doel_identificatie
  FROM bag_published.relaties WHERE datasetversie_id=:dataset_id
  ORDER BY bron_objecttype DESC, bron_identificatie DESC, relatietype DESC, doel_identificatie DESC LIMIT 1
), next_rows AS (
  SELECT s.bron_objecttype, s.bron_identificatie, s.relatietype, s.doel_identificatie
  FROM bag_staging.relaties s LEFT JOIN last_key l ON true
  WHERE s.datasetversie_id=:dataset_id
    AND (l.bron_objecttype IS NULL OR (s.bron_objecttype,s.bron_identificatie,s.relatietype,s.doel_identificatie) > (l.bron_objecttype,l.bron_identificatie,l.relatietype,l.doel_identificatie))
  ORDER BY s.bron_objecttype, s.bron_identificatie, s.relatietype, s.doel_identificatie LIMIT :chunk_size
)
INSERT INTO bag_published.relaties (
  datasetversie_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie
)
SELECT :dataset_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie FROM next_rows;
RESET ROLE;
REVOKE bag_publisher FROM postgres GRANTED BY postgres;
COMMIT;
SQL
      ;;
    geometrieen)
      psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v dataset_id="$DATASET_ID" -v chunk_size="$CHUNK_SIZE" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='110s';
SET LOCAL lock_timeout='5s';
GRANT bag_publisher TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_publisher;
WITH last_key AS (
  SELECT objecttype, identificatie, voorkomen_sleutel, geometrie_volgnummer
  FROM bag_published.geometrieen WHERE datasetversie_id=:dataset_id
  ORDER BY objecttype DESC, identificatie DESC, voorkomen_sleutel DESC, geometrie_volgnummer DESC LIMIT 1
), next_rows AS (
  SELECT s.objecttype, s.identificatie, s.voorkomen_sleutel, s.voorkomenidentificatie,
         s.geometrie_volgnummer, s.geometrie
  FROM bag_staging.geometrieen s LEFT JOIN last_key l ON true
  WHERE s.datasetversie_id=:dataset_id
    AND (l.objecttype IS NULL OR (s.objecttype,s.identificatie,s.voorkomen_sleutel,s.geometrie_volgnummer) > (l.objecttype,l.identificatie,l.voorkomen_sleutel,l.geometrie_volgnummer))
  ORDER BY s.objecttype, s.identificatie, s.voorkomen_sleutel, s.geometrie_volgnummer LIMIT :chunk_size
)
INSERT INTO bag_published.geometrieen (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
  geometrie_volgnummer, geometrie
)
SELECT :dataset_id, objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
       geometrie_volgnummer, geometrie FROM next_rows;
RESET ROLE;
REVOKE bag_publisher FROM postgres GRANTED BY postgres;
COMMIT;
SQL
      ;;
  esac
}

run_phase() {
  local phase="$1" expected="$2" current before
  current="$(count_published "$phase")"
  while (( current < expected )); do
    before="$current"
    echo "Publiceer $phase vanaf $current / $expected (chunk $CHUNK_SIZE)"
    publish_chunk "$phase"
    assert_dataset_guard
    current="$(count_published "$phase")"
    (( current > before )) || fail "$phase maakte geen voortgang."
    (( current <= expected )) || fail "$phase overschreed verwachte telling."
    printf '%s\t%s\t%s\n' "$phase" "$current" "$(date -u +%FT%TZ)" >>"$OUTPUT_DIR/progress.tsv"
  done
  [[ "$current" == "$expected" ]] || fail "$phase eindtelling wijkt af."
}

validate_parity() {
  psql "$BAG_SHADOW_DATABASE_URL" -X -qAt -F $'\t' -v ON_ERROR_STOP=1 -v dataset_id="$DATASET_ID" <<'SQL' >"$OUTPUT_DIR/validatie.tsv"
SET statement_timeout='10min';
SELECT 'dataset', id, datasetversie, scope_code, status, is_actief FROM bag_control.datasetversies WHERE id=:dataset_id;
SELECT 'objecten', (SELECT count(*) FROM bag_staging.objecten WHERE datasetversie_id=:dataset_id), (SELECT count(*) FROM bag_published.objecten WHERE datasetversie_id=:dataset_id);
SELECT 'voorkomens', (SELECT count(*) FROM bag_staging.voorkomens WHERE datasetversie_id=:dataset_id), (SELECT count(*) FROM bag_published.voorkomens WHERE datasetversie_id=:dataset_id);
SELECT 'relaties', (SELECT count(*) FROM bag_staging.relaties WHERE datasetversie_id=:dataset_id), (SELECT count(*) FROM bag_published.relaties WHERE datasetversie_id=:dataset_id);
SELECT 'geometrieen', (SELECT count(*) FROM bag_staging.geometrieen WHERE datasetversie_id=:dataset_id), (SELECT count(*) FROM bag_published.geometrieen WHERE datasetversie_id=:dataset_id);
SELECT 'objecten_mismatch', count(*) FROM (
  SELECT s.objecttype, s.identificatie FROM bag_staging.objecten s
  LEFT JOIN bag_published.objecten p USING (datasetversie_id, objecttype, identificatie)
  WHERE s.datasetversie_id=:dataset_id AND p.datasetversie_id IS NULL
) q;
SELECT 'voorkomens_mismatch', count(*) FROM (
  SELECT 1 FROM bag_staging.voorkomens s
  LEFT JOIN bag_published.voorkomens p USING (datasetversie_id, objecttype, identificatie, voorkomen_sleutel)
  WHERE s.datasetversie_id=:dataset_id AND (
    p.datasetversie_id IS NULL OR p.voorkomenidentificatie IS DISTINCT FROM s.voorkomenidentificatie
    OR p.is_actueel IS DISTINCT FROM s.is_actueel OR p.begin_geldigheid IS DISTINCT FROM s.begin_geldigheid
    OR p.eind_geldigheid IS DISTINCT FROM s.eind_geldigheid OR p.status IS DISTINCT FROM s.status
    OR p.velden IS DISTINCT FROM s.velden)
) q;
SELECT 'relaties_mismatch', count(*) FROM (
  SELECT 1 FROM bag_staging.relaties s
  LEFT JOIN bag_published.relaties p USING (datasetversie_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie)
  WHERE s.datasetversie_id=:dataset_id AND p.datasetversie_id IS NULL
) q;
SELECT 'geometrieen_mismatch', count(*) FROM (
  SELECT 1 FROM bag_staging.geometrieen s
  LEFT JOIN bag_published.geometrieen p USING (datasetversie_id, objecttype, identificatie, voorkomen_sleutel, geometrie_volgnummer)
  WHERE s.datasetversie_id=:dataset_id AND (
    p.datasetversie_id IS NULL OR p.voorkomenidentificatie IS DISTINCT FROM s.voorkomenidentificatie
    OR NOT extensions.st_equals(p.geometrie, s.geometrie))
) q;
SELECT 'assen_actief', count(*) FROM bag_control.datasetversies WHERE scope_code='0106' AND status='actief' AND is_actief;
SELECT 'amsterdam_actief', count(*) FROM bag_control.datasetversies WHERE scope_code='0363' AND is_actief;
SQL

  grep -q $'^dataset\t2\tv20260805\t0363\tgevalideerd\tf$' "$OUTPUT_DIR/validatie.tsv" || fail 'datasetstatus wijzigde tijdens publication.'
  grep -q $'^objecten\t1464429\t1464429$' "$OUTPUT_DIR/validatie.tsv" || fail 'objectenpariteit faalde.'
  grep -q $'^voorkomens\t2664890\t2664890$' "$OUTPUT_DIR/validatie.tsv" || fail 'voorkomenspariteit faalde.'
  grep -q $'^relaties\t2531300\t2531300$' "$OUTPUT_DIR/validatie.tsv" || fail 'relatiespariteit faalde.'
  grep -q $'^geometrieen\t1830704\t1830704$' "$OUTPUT_DIR/validatie.tsv" || fail 'geometriepariteit faalde.'
  grep -q $'^objecten_mismatch\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'objectinhoud wijkt af.'
  grep -q $'^voorkomens_mismatch\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'voorkomeninhoud wijkt af.'
  grep -q $'^relaties_mismatch\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'relatieinhoud wijkt af.'
  grep -q $'^geometrieen_mismatch\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'geometrieinhoud wijkt af.'
  grep -q $'^assen_actief\t1$' "$OUTPUT_DIR/validatie.tsv" || fail 'Assen actieve status wijzigde.'
  grep -q $'^amsterdam_actief\t0$' "$OUTPUT_DIR/validatie.tsv" || fail 'Amsterdam werd onverwacht actief.'
}

write_report() {
  local o v r g
  o="$(count_published objecten)"; v="$(count_published voorkomens)"; r="$(count_published relaties)"; g="$(count_published geometrieen)"
  {
    echo '# BAG Amsterdam publication writer'
    echo
    echo "- Projectref: $EXPECTED_SHADOW_REF"
    echo "- Dataset: $DATASET_ID / $DATASET_VERSION / $SCOPE_CODE"
    echo "- Fase: $PHASE"
    echo "- Published objecten: $o / $EXPECTED_OBJECTEN"
    echo "- Published voorkomens: $v / $EXPECTED_VOORKOMENS"
    echo "- Published relaties: $r / $EXPECTED_RELATIES"
    echo "- Published geometrieen: $g / $EXPECTED_GEOMETRIEEN"
    echo '- Activation performed: false'
    echo '- Productie benaderd: nee'
    echo '- CRM-shadow benaderd: nee'
  } >"$OUTPUT_DIR/rapport.md"
}

write_preflight
assert_dataset_guard
assert_staging_counts
assert_phase_order

case "$PHASE" in
  objecten) run_phase objecten "$EXPECTED_OBJECTEN" ;;
  voorkomens) run_phase voorkomens "$EXPECTED_VOORKOMENS" ;;
  relaties) run_phase relaties "$EXPECTED_RELATIES" ;;
  geometrieen) run_phase geometrieen "$EXPECTED_GEOMETRIEEN" ;;
  validate) validate_parity ;;
esac

assert_dataset_guard
assert_phase_order
write_report

echo "AMSTERDAM_RESUMABLE_PUBLICATION_PHASE_OK phase=$PHASE activation_performed=false"
