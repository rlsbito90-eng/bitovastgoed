#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_AMSTERDAM_PUBLICATION_APPROVAL:?BAG_AMSTERDAM_PUBLICATION_APPROVAL is verplicht}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="$ROOT_DIR/scripts/bag/run-amsterdam-shadow-resumable-publication.sh"
EXPECTED_BASE_BLOB="8e0f1fcd7cdcea0d8bba765fc2a15ad588c5ce15"
APPROVAL="PUBLISH_BAG_AMSTERDAM_DIRECTIONAL_ARTIFACT_9027302674_TO_SHADOW"

fail() { echo "Weigering: $*" >&2; exit 1; }
[[ "$BAG_SHADOW_PROJECT_REF" == 'xfygspvpeugxowxbcvnm' ]] || fail 'onjuiste shadowprojectref.'
[[ "$BAG_AMSTERDAM_PUBLICATION_APPROVAL" == "$APPROVAL" ]] || fail 'onjuiste v3 publication approval.'
[[ "$(git hash-object "$BASE")" == "$EXPECTED_BASE_BLOB" ]] || fail 'legacy publisher is gewijzigd; v3-wrapper weigert drift.'

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
python3 - "$BASE" "$TMP" <<'PY'
from pathlib import Path
import sys
src = Path(sys.argv[1]).read_text()
repls = {
    'PUBLISH_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW': 'PUBLISH_BAG_AMSTERDAM_DIRECTIONAL_ARTIFACT_9027302674_TO_SHADOW',
    'DATASET_ID=2': 'DATASET_ID=3',
    'DATASET_VERSION="v20260805"': 'DATASET_VERSION="v20260808-directional-v3"',
    'EXPECTED_OBJECTEN=1464429': 'EXPECTED_OBJECTEN=1491131',
    'EXPECTED_VOORKOMENS=2664890': 'EXPECTED_VOORKOMENS=2719273',
    'EXPECTED_RELATIES=2531300': 'EXPECTED_RELATIES=2564885',
    'EXPECTED_GEOMETRIEEN=1830704': 'EXPECTED_GEOMETRIEEN=1872231',
    'EXPECTED_GEOMETRIE_AFWIJKINGEN=1016': 'EXPECTED_GEOMETRIE_AFWIJKINGEN=1021',
    "$'2\\tv20260805\\t0363\\tgevalideerd\\tfalse'": "$'3\\tv20260808-directional-v3\\t0363\\tgevalideerd\\tfalse'",
    "[[ \"$(psql_scalar \"SELECT count(*) FROM bag_control.datasetversies WHERE scope_code='0363' AND is_actief\")\" == '0' ]] || fail 'Amsterdam is onverwacht actief.'": "[[ \"$(psql_scalar \"SELECT count(*) FROM bag_control.datasetversies WHERE scope_code='0363' AND is_actief\")\" == '1' ]] || fail 'Amsterdam heeft niet exact één actieve versie.'\n  [[ \"$(psql_scalar \"SELECT count(*) FROM bag_control.datasetversies WHERE id=2 AND datasetversie='v20260805' AND scope_code='0363' AND status='actief' AND is_actief\")\" == '1' ]] || fail 'Oude Amsterdam-versie is niet exact actief gebleven.'\n  [[ \"$(psql_scalar \"SELECT count(*) FROM bag_control.datasetversies WHERE scope_code='0363'\")\" == '2' ]] || fail 'Onverwacht aantal Amsterdam-datasetversies.'",
    "$'^dataset\\t2\\tv20260805\\t0363\\tgevalideerd\\tf$'": "$'^dataset\\t3\\tv20260808-directional-v3\\t0363\\tgevalideerd\\tf$'",
    "$'^objecten\\t1464429\\t1464429$'": "$'^objecten\\t1491131\\t1491131$'",
    "$'^voorkomens\\t2664890\\t2664890$'": "$'^voorkomens\\t2719273\\t2719273$'",
    "$'^relaties\\t2531300\\t2531300$'": "$'^relaties\\t2564885\\t2564885$'",
    "$'^geometrieen\\t1830704\\t1830704$'": "$'^geometrieen\\t1872231\\t1872231$'",
    "$'^amsterdam_actief\\t0$'": "$'^amsterdam_actief\\t1$'",
}
for old, new in repls.items():
    if old not in src:
        raise SystemExit(f'Verwacht legacy-token ontbreekt: {old}')
    src = src.replace(old, new)
for old in repls:
    if old in src:
        raise SystemExit(f'Legacy-token bleef achter: {old}')
Path(sys.argv[2]).write_text(src)
PY
chmod +x "$TMP"
exec "$TMP" "$@"
