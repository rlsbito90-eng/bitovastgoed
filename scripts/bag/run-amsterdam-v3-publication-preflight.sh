#!/usr/bin/env bash
set -euo pipefail

: "${BAG_SHADOW_DATABASE_URL:?BAG_SHADOW_DATABASE_URL is verplicht}"
: "${BAG_SHADOW_PROJECT_REF:?BAG_SHADOW_PROJECT_REF is verplicht}"
: "${BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_APPROVAL:?BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_APPROVAL is verplicht}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="$ROOT_DIR/scripts/bag/run-amsterdam-shadow-publication-preflight.sh"
EXPECTED_BASE_BLOB="a9fda8221567b7f2dcc9c559f0e65dfa03ccaead"
APPROVAL="CHECK_BAG_AMSTERDAM_DIRECTIONAL_V3_PUBLICATION_PREFLIGHT"

fail() { echo "Weigering: $*" >&2; exit 1; }

[[ "$BAG_SHADOW_PROJECT_REF" == 'xfygspvpeugxowxbcvnm' ]] || fail 'onjuiste shadowprojectref.'
[[ "$BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_APPROVAL" == "$APPROVAL" ]] || fail 'onjuiste v3 preflight approval.'
[[ "$(git hash-object "$BASE")" == "$EXPECTED_BASE_BLOB" ]] || fail 'legacy publication-preflight is gewijzigd; v3-wrapper weigert drift.'

# Coexistence-guard: de gevalideerde v3-versie blijft inactief en alleen de bekende oude versie is actief.
psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt <<'SQL' | grep -qx $'2\tv20260805\tactief\tt\n3\tv20260808-directional-v3\tgevalideerd\tf'
BEGIN READ ONLY;
SET LOCAL TRANSACTION READ ONLY;
SELECT id, datasetversie, status, is_actief
FROM bag_control.datasetversies
WHERE scope_code='0363'
ORDER BY id;
ROLLBACK;
SQL

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
python3 - "$BASE" "$TMP" <<'PY'
from pathlib import Path
import sys
src = Path(sys.argv[1]).read_text()
repls = {
    'CHECK_BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_8973886061': 'CHECK_BAG_AMSTERDAM_DIRECTIONAL_V3_PUBLICATION_PREFLIGHT',
    'DATASET_ID=2': 'DATASET_ID=3',
    'DATASET_VERSION="v20260805"': 'DATASET_VERSION="v20260808-directional-v3"',
    'EXPECTED_OBJECTEN=1464429': 'EXPECTED_OBJECTEN=1491131',
    'EXPECTED_VOORKOMENS=2664890': 'EXPECTED_VOORKOMENS=2719273',
    'EXPECTED_RELATIES=2531300': 'EXPECTED_RELATIES=2564885',
    'EXPECTED_GEOMETRIEEN_VALID=1830704': 'EXPECTED_GEOMETRIEEN_VALID=1872231',
    'EXPECTED_GEOMETRIE_AFWIJKINGEN=1016': 'EXPECTED_GEOMETRIE_AFWIJKINGEN=1021',
    'EXPECTED_GEOMETRIEEN_BRON=1831720': 'EXPECTED_GEOMETRIEEN_BRON=1873252',
    "$'^dataset\\t2\\tv20260805\\t0363\\tgevalideerd\\tf$'": "$'^dataset\\t3\\tv20260808-directional-v3\\t0363\\tgevalideerd\\tf$'",
    "$'^objecten\\t1464429$'": "$'^objecten\\t1491131$'",
    "$'^voorkomens\\t2664890$'": "$'^voorkomens\\t2719273$'",
    "$'^relaties\\t2531300$'": "$'^relaties\\t2564885$'",
    "$'^geometrieen\\t1830704$'": "$'^geometrieen\\t1872231$'",
    "$'^geometrie_afwijkingen\\t1016$'": "$'^geometrie_afwijkingen\\t1021$'",
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
exec "$TMP" "${1:-bag-amsterdam-v3-publication-preflight-resultaat}"
