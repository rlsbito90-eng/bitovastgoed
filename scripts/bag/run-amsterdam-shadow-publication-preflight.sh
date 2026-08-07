#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_APPROVAL:?BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_APPROVAL is verplicht}"
: "${BAG_AMSTERDAM_DISK_CAP_GIB:?BAG_AMSTERDAM_DISK_CAP_GIB is verplicht}"

EXPECTED_SHADOW_REF="xfygspvpeugxowxbcvnm"
PRODUCTION_REF="ljudxyrqoifhfikueric"
CRM_SHADOW_REF="wzkhmjuasyuvzhhycnym"
APPROVAL_PHRASE="CHECK_BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_8973886061"
DATASET_ID=2
DATASET_VERSION="v20260805"
SCOPE_CODE="0363"
EXPECTED_OBJECTEN=1464429
EXPECTED_VOORKOMENS=2664890
EXPECTED_RELATIES=2531300
EXPECTED_GEOMETRIEEN_VALID=1830704
EXPECTED_GEOMETRIE_AFWIJKINGEN=1016
EXPECTED_GEOMETRIEEN_BRON=1831720
SAFETY_FACTOR_PERCENT=125
MIN_HEADROOM_BYTES=$((1024 * 1024 * 1024))
OUTPUT_DIR="${1:-bag-amsterdam-publication-preflight-resultaat}"

fail() { echo "Weigering: $*" >&2; exit 1; }

[[ "$BAG_SHADOW_PROJECT_REF" == "$EXPECTED_SHADOW_REF" ]] || fail 'onjuiste projectref.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$PRODUCTION_REF" ]] || fail 'productie is uitgesloten.'
[[ "$BAG_SHADOW_PROJECT_REF" != "$CRM_SHADOW_REF" ]] || fail 'CRM-shadow is uitgesloten.'
[[ "$BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_APPROVAL" == "$APPROVAL_PHRASE" ]] || fail 'onjuiste preflight-approval phrase.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$PRODUCTION_REF"* ]] || fail 'database-URL verwijst naar productie.'
[[ "$BAG_SHADOW_DATABASE_URL" != *"$CRM_SHADOW_REF"* ]] || fail 'database-URL verwijst naar CRM-shadow.'
[[ "$BAG_SHADOW_DATABASE_URL" == *"sslmode=require"* ]] || fail 'sslmode=require ontbreekt.'
[[ "$BAG_AMSTERDAM_DISK_CAP_GIB" =~ ^[1-9][0-9]*$ ]] || fail 'disk cap moet een positief geheel aantal GiB zijn.'
command -v psql >/dev/null || fail 'psql ontbreekt.'
mkdir -p "$OUTPUT_DIR"

disk_cap_bytes=$((BAG_AMSTERDAM_DISK_CAP_GIB * 1024 * 1024 * 1024))

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' \
  -v dataset_id="$DATASET_ID" \
  -v dataset_version="$DATASET_VERSION" \
  -v scope_code="$SCOPE_CODE" <<'SQL' >"$OUTPUT_DIR/preflight.tsv"
SELECT 'dataset', id, datasetversie, scope_code, status, is_actief
FROM bag_control.datasetversies
WHERE id=:dataset_id;

SELECT 'objecten', count(*) FROM bag_staging.objecten WHERE datasetversie_id=:dataset_id;
SELECT 'voorkomens', count(*) FROM bag_staging.voorkomens WHERE datasetversie_id=:dataset_id;
SELECT 'relaties', count(*) FROM bag_staging.relaties WHERE datasetversie_id=:dataset_id;
SELECT 'geometrieen', count(*) FROM bag_staging.geometrieen WHERE datasetversie_id=:dataset_id;
SELECT 'geometrie_afwijkingen', count(*) FROM bag_control.geometrie_afwijkingen WHERE datasetversie_id=:dataset_id;
SELECT 'published_objecten', count(*) FROM bag_published.objecten WHERE datasetversie_id=:dataset_id;
SELECT 'published_voorkomens', count(*) FROM bag_published.voorkomens WHERE datasetversie_id=:dataset_id;
SELECT 'published_relaties', count(*) FROM bag_published.relaties WHERE datasetversie_id=:dataset_id;
SELECT 'published_geometrieen', count(*) FROM bag_published.geometrieen WHERE datasetversie_id=:dataset_id;
SELECT 'assen_actief', count(*) FROM bag_control.datasetversies WHERE scope_code='0106' AND status='actief' AND is_actief;
SELECT 'database_bytes', pg_database_size(current_database());

SELECT 'published_total_objecten', count(*) FROM bag_published.objecten;
SELECT 'published_total_voorkomens', count(*) FROM bag_published.voorkomens;
SELECT 'published_total_relaties', count(*) FROM bag_published.relaties;
SELECT 'published_total_geometrieen', count(*) FROM bag_published.geometrieen;
SELECT 'published_objecten_bytes', pg_total_relation_size('bag_published.objecten'::regclass);
SELECT 'published_voorkomens_bytes', pg_total_relation_size('bag_published.voorkomens'::regclass);
SELECT 'published_relaties_bytes', pg_total_relation_size('bag_published.relaties'::regclass);
SELECT 'published_geometrieen_bytes', pg_total_relation_size('bag_published.geometrieen'::regclass);
SQL

expect_line() {
  local pattern="$1" message="$2"
  grep -q "$pattern" "$OUTPUT_DIR/preflight.tsv" || fail "$message"
}

value() { awk -F '\t' -v key="$1" '$1==key{print $2}' "$OUTPUT_DIR/preflight.tsv"; }

expect_line $'^dataset\t2\tv20260805\t0363\tgevalideerd\tf$' 'Amsterdam-dataset is niet exact gevalideerd en inactief.'
expect_line $'^objecten\t1464429$' 'objecttelling wijkt af.'
expect_line $'^voorkomens\t2664890$' 'voorkomentelling wijkt af.'
expect_line $'^relaties\t2531300$' 'relatietelling wijkt af.'
expect_line $'^geometrieen\t1830704$' 'geldige geometrietelling wijkt af.'
expect_line $'^geometrie_afwijkingen\t1016$' 'geometriequarantaine wijkt af.'
expect_line $'^assen_actief\t1$' 'Assen is niet exact één keer actief.'

valid_geom="$(value geometrieen)"
invalid_geom="$(value geometrie_afwijkingen)"
[[ $((valid_geom + invalid_geom)) -eq "$EXPECTED_GEOMETRIEEN_BRON" ]] || fail 'geometriebronreconciliatie faalt.'

published_objecten="$(value published_objecten)"
published_voorkomens="$(value published_voorkomens)"
published_relaties="$(value published_relaties)"
published_geometrieen="$(value published_geometrieen)"

for n in "$published_objecten" "$published_voorkomens" "$published_relaties" "$published_geometrieen"; do
  [[ "$n" =~ ^[0-9]+$ ]] || fail 'Amsterdam-publicatievoortgang is niet numeriek.'
done

(( published_objecten <= EXPECTED_OBJECTEN )) || fail 'Amsterdam-objecten overschrijden de gevalideerde stagingtelling.'
(( published_voorkomens <= EXPECTED_VOORKOMENS )) || fail 'Amsterdam-voorkomens overschrijden de gevalideerde stagingtelling.'
(( published_relaties <= EXPECTED_RELATIES )) || fail 'Amsterdam-relaties overschrijden de gevalideerde stagingtelling.'
(( published_geometrieen <= EXPECTED_GEOMETRIEEN_VALID )) || fail 'Amsterdam-geometrieën overschrijden de geldige stagingtelling.'

if (( published_voorkomens > 0 )); then
  (( published_objecten == EXPECTED_OBJECTEN )) || fail 'voorkomens bestaan terwijl objecten niet exact compleet zijn.'
fi
if (( published_relaties > 0 )); then
  (( published_voorkomens == EXPECTED_VOORKOMENS )) || fail 'relaties bestaan terwijl voorkomens niet exact compleet zijn.'
fi
if (( published_geometrieen > 0 )); then
  (( published_relaties == EXPECTED_RELATIES )) || fail 'geometrieën bestaan terwijl relaties niet exact compleet zijn.'
fi

current_database_bytes="$(value database_bytes)"
pub_obj_count="$(value published_total_objecten)"
pub_vkr_count="$(value published_total_voorkomens)"
pub_rel_count="$(value published_total_relaties)"
pub_geo_count="$(value published_total_geometrieen)"
pub_obj_bytes="$(value published_objecten_bytes)"
pub_vkr_bytes="$(value published_voorkomens_bytes)"
pub_rel_bytes="$(value published_relaties_bytes)"
pub_geo_bytes="$(value published_geometrieen_bytes)"

for n in "$current_database_bytes" "$pub_obj_count" "$pub_vkr_count" "$pub_rel_count" "$pub_geo_count" \
         "$pub_obj_bytes" "$pub_vkr_bytes" "$pub_rel_bytes" "$pub_geo_bytes"; do
  [[ "$n" =~ ^[0-9]+$ ]] || fail 'preflight leverde een ongeldige numerieke waarde.'
done
(( pub_obj_count > 0 && pub_vkr_count > 0 && pub_rel_count > 0 && pub_geo_count > 0 )) || \
  fail 'bestaande published-benchmark ontbreekt; capaciteit kan niet betrouwbaar worden geschat.'

remaining_objecten=$((EXPECTED_OBJECTEN - published_objecten))
remaining_voorkomens=$((EXPECTED_VOORKOMENS - published_voorkomens))
remaining_relaties=$((EXPECTED_RELATIES - published_relaties))
remaining_geometrieen=$((EXPECTED_GEOMETRIEEN_VALID - published_geometrieen))

estimate_table() {
  local published_bytes="$1" published_rows="$2" remaining_rows="$3"
  if (( remaining_rows == 0 )); then
    echo 0
  else
    echo $(( (published_bytes * remaining_rows + published_rows - 1) / published_rows ))
  fi
}

estimate_obj="$(estimate_table "$pub_obj_bytes" "$pub_obj_count" "$remaining_objecten")"
estimate_vkr="$(estimate_table "$pub_vkr_bytes" "$pub_vkr_count" "$remaining_voorkomens")"
estimate_rel="$(estimate_table "$pub_rel_bytes" "$pub_rel_count" "$remaining_relaties")"
estimate_geo="$(estimate_table "$pub_geo_bytes" "$pub_geo_count" "$remaining_geometrieen")"
estimated_publish_bytes=$((estimate_obj + estimate_vkr + estimate_rel + estimate_geo))
conservative_publish_bytes=$(( (estimated_publish_bytes * SAFETY_FACTOR_PERCENT + 99) / 100 ))
projected_database_bytes=$((current_database_bytes + conservative_publish_bytes))
required_capacity_bytes=$((projected_database_bytes + MIN_HEADROOM_BYTES))

if (( required_capacity_bytes <= disk_cap_bytes )); then
  decision="GO"
  exit_code=0
else
  decision="NO_GO_CAPACITY"
  exit_code=3
fi

{
  echo "decision=$decision"
  echo "project_ref=$EXPECTED_SHADOW_REF"
  echo "dataset_id=$DATASET_ID"
  echo "datasetversie=$DATASET_VERSION"
  echo "scope_code=$SCOPE_CODE"
  echo "status_required=gevalideerd"
  echo "is_actief_required=false"
  echo "disk_cap_gib=$BAG_AMSTERDAM_DISK_CAP_GIB"
  echo "disk_cap_bytes=$disk_cap_bytes"
  echo "current_database_bytes=$current_database_bytes"
  echo "published_objecten=$published_objecten"
  echo "published_voorkomens=$published_voorkomens"
  echo "published_relaties=$published_relaties"
  echo "published_geometrieen=$published_geometrieen"
  echo "remaining_objecten=$remaining_objecten"
  echo "remaining_voorkomens=$remaining_voorkomens"
  echo "remaining_relaties=$remaining_relaties"
  echo "remaining_geometrieen=$remaining_geometrieen"
  echo "estimated_publish_bytes=$estimated_publish_bytes"
  echo "safety_factor_percent=$SAFETY_FACTOR_PERCENT"
  echo "conservative_publish_bytes=$conservative_publish_bytes"
  echo "projected_database_bytes=$projected_database_bytes"
  echo "minimum_headroom_bytes=$MIN_HEADROOM_BYTES"
  echo "required_capacity_bytes=$required_capacity_bytes"
  echo "expected_geometrieen_valid=$EXPECTED_GEOMETRIEEN_VALID"
  echo "expected_geometrie_afwijkingen=$EXPECTED_GEOMETRIE_AFWIJKINGEN"
  echo "expected_geometrieen_bron=$EXPECTED_GEOMETRIEEN_BRON"
  echo "publication_performed=false"
  echo "activation_performed=false"
} >"$OUTPUT_DIR/capaciteit.env"

{
  echo '# BAG Amsterdam publication preflight'
  echo
  echo "- Besluit: **$decision**"
  echo "- Dataset: $DATASET_VERSION / $SCOPE_CODE / id $DATASET_ID"
  echo '- Alleen read-only controles uitgevoerd: ja'
  echo '- Publicatie uitgevoerd door deze preflight: nee'
  echo '- Activatie uitgevoerd: nee'
  echo "- Amsterdam publication progress: objecten=$published_objecten, voorkomens=$published_voorkomens, relaties=$published_relaties, geometrieen=$published_geometrieen"
  echo "- Huidige databasebytes: $current_database_bytes"
  echo "- Geschatte resterende published-bytes: $estimated_publish_bytes"
  echo "- Conservatieve resterende published-bytes (x${SAFETY_FACTOR_PERCENT}%): $conservative_publish_bytes"
  echo "- Vereiste capaciteit incl. 1 GiB vrije marge: $required_capacity_bytes"
  echo "- Opgegeven disk-cap: $disk_cap_bytes"
} >"$OUTPUT_DIR/rapport.md"

cat "$OUTPUT_DIR/capaciteit.env"
exit "$exit_code"
