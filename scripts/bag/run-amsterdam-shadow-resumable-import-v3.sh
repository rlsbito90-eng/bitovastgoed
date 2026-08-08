#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_SCRIPT="$ROOT_DIR/scripts/bag/run-amsterdam-shadow-resumable-import.sh"

: "${BAG_AMSTERDAM_APPROVAL:?BAG_AMSTERDAM_APPROVAL is verplicht}"
: "${BAG_AMSTERDAM_ARTIFACT_ID:?BAG_AMSTERDAM_ARTIFACT_ID is verplicht}"

EXPECTED_APPROVAL="APPLY_BAG_AMSTERDAM_DIRECTIONAL_ARTIFACT_9027302674_TO_SHADOW"
EXPECTED_ARTIFACT_ID="9027302674"

[[ "$BAG_AMSTERDAM_APPROVAL" == "$EXPECTED_APPROVAL" ]] || {
  echo 'Weigering: onjuiste v3 approval phrase.' >&2
  exit 1
}
[[ "$BAG_AMSTERDAM_ARTIFACT_ID" == "$EXPECTED_ARTIFACT_ID" ]] || {
  echo 'Weigering: onjuist v3 artifact-id.' >&2
  exit 1
}
[[ -s "$BASE_SCRIPT" ]] || {
  echo 'Weigering: legacy resumable basisscript ontbreekt.' >&2
  exit 1
}

TMP_SCRIPT="$(mktemp)"
trap 'rm -f "$TMP_SCRIPT"' EXIT
cp "$BASE_SCRIPT" "$TMP_SCRIPT"

python - "$TMP_SCRIPT" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')

replacements = {
    'APPLY_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW': 'APPLY_BAG_AMSTERDAM_DIRECTIONAL_ARTIFACT_9027302674_TO_SHADOW',
    "BAG_AMSTERDAM_ARTIFACT_ID\" == '8973886061'": "BAG_AMSTERDAM_ARTIFACT_ID\" == '9027302674'",
    'amsterdam_artifact_8973886061': 'amsterdam_directional_artifact_9027302674',
    'v20260805': 'v20260808-directional-v3',
    'EXPECTED_OBJECTEN=1464429': 'EXPECTED_OBJECTEN=1491131',
    'EXPECTED_VOORKOMENS_RAW=2664897': 'EXPECTED_VOORKOMENS_RAW=2719280',
    'EXPECTED_VOORKOMENS=2664890': 'EXPECTED_VOORKOMENS=2719273',
    'EXPECTED_RELATIES=2531300': 'EXPECTED_RELATIES=2564885',
    'EXPECTED_GEOMETRIEEN=1831720': 'EXPECTED_GEOMETRIEEN=1873252',
    "'objecten_expected', 1464429": "'objecten_expected', 1491131",
    "'voorkomens_bronregels_expected', 2664897": "'voorkomens_bronregels_expected', 2719280",
    "'voorkomens_uniek_expected', 2664890": "'voorkomens_uniek_expected', 2719273",
    "'relaties_expected', 2531300": "'relaties_expected', 2564885",
    "'geometrieen_expected', 1831720": "'geometrieen_expected', 1873252",
    "'^objecten\\t1464429$'": "'^objecten\\t1491131$'",
    "'^voorkomens\\t2664890$'": "'^voorkomens\\t2719273$'",
    "'^relaties\\t2531300$'": "'^relaties\\t2564885$'",
    'Kadaster landelijke BAG-selectie Amsterdam': 'Kadaster landelijke BAG-selectie Amsterdam+Weesp directioneel v3',
}

missing = [old for old in replacements if old not in text]
if missing:
    raise SystemExit('Basisscriptcontract is onverwacht gewijzigd; ontbrekende tokens: ' + repr(missing))

for old, new in replacements.items():
    text = text.replace(old, new)

for forbidden in [
    '8973886061',
    'v20260805',
    '1464429',
    '2664897',
    '2664890',
    '2531300',
    '1831720',
]:
    if forbidden in text:
        raise SystemExit(f'Legacy token bleef achter na v3-transformatie: {forbidden}')

required = [
    'APPLY_BAG_AMSTERDAM_DIRECTIONAL_ARTIFACT_9027302674_TO_SHADOW',
    "BAG_AMSTERDAM_ARTIFACT_ID\" == '9027302674'",
    'DATASET_VERSION="v20260808-directional-v3"',
    'EXPECTED_OBJECTEN=1491131',
    'EXPECTED_VOORKOMENS_RAW=2719280',
    'EXPECTED_VOORKOMENS=2719273',
    'EXPECTED_VOORKOMENS_IDENTIEKE_DUPLICATEN=7',
    'EXPECTED_RELATIES=2564885',
    'EXPECTED_GEOMETRIEEN=1873252',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Verplichte v3-token ontbreekt na transformatie: {token}')

path.write_text(text, encoding='utf-8')
PY

chmod 700 "$TMP_SCRIPT"
exec bash "$TMP_SCRIPT" "$@"
