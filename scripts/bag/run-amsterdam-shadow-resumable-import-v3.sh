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
    'local id current tmpdir index chunk rows inserted deduplicated': 'local id current source_offset tmpdir index chunk rows inserted deduplicated',
}

resume_old = '''  if (( current == expected )); then echo "$phase reeds compleet ($current verwerkte bronrijen)."; return 0; fi
  tmpdir="$OUTPUT_DIR/chunks-$phase"; rm -rf "$tmpdir"; mkdir -p "$tmpdir"
  tail -n "+$((current + 1))" "$csv" | split -l "$CHUNK_SIZE" -d -a 5 - "$tmpdir/chunk-"
'''
resume_new = '''  if (( current == expected )); then echo "$phase reeds compleet ($current verwerkte bronrijen)."; return 0; fi
  source_offset="$current"
  if [[ "$phase" == 'voorkomens' && "$current" -gt 0 ]]; then
    source_offset="$(python - "$csv" "$current" <<'PYRESUME'
import csv
import sys

pad = sys.argv[1]
target_uniek = int(sys.argv[2])
raw = 0
uniek = 0
vorige = None

with open(pad, 'r', encoding='utf-8', newline='') as handle:
    for regel in csv.reader(handle):
        raw += 1
        sleutel = tuple(regel[:3])
        if sleutel != vorige:
            uniek += 1
            if uniek > target_uniek:
                print(raw - 1)
                break
        vorige = sleutel
    else:
        if uniek == target_uniek:
            print(raw)
        else:
            raise SystemExit(f'Kan raw resume-offset niet bepalen: uniek={uniek}, target={target_uniek}')
PYRESUME
)"
    [[ "$source_offset" =~ ^[0-9]+$ ]] || fail 'ongeldige raw resume-offset voor voorkomens.'
    (( source_offset >= current )) || fail 'raw resume-offset ligt vóór unieke DB-telling.'
    echo "Hervat voorkomens: unieke DB-rijen=$current, raw CSV-offset=$source_offset"
  fi
  tmpdir="$OUTPUT_DIR/chunks-$phase"; rm -rf "$tmpdir"; mkdir -p "$tmpdir"
  tail -n "+$((source_offset + 1))" "$csv" | split -l "$CHUNK_SIZE" -d -a 5 - "$tmpdir/chunk-"
'''

missing = [old for old in replacements if old not in text]
if resume_old not in text:
    missing.append('resume-offset-basissegment')
if missing:
    raise SystemExit('Basisscriptcontract is onverwacht gewijzigd; ontbrekende tokens: ' + repr(missing))

for old, new in replacements.items():
    text = text.replace(old, new)
text = text.replace(resume_old, resume_new)

prepare_guard_old = '''DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE scope_code = '0363' AND datasetversie <> 'v20260808-directional-v3'
  ) THEN
    RAISE EXCEPTION 'Andere Amsterdam-datasetversie bestaat al.';
  END IF;
END
$guard$;
'''
prepare_guard_new = '''DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE scope_code = '0363'
      AND datasetversie NOT IN ('v20260805', 'v20260808-directional-v3')
  ) THEN
    RAISE EXCEPTION 'Onverwachte derde Amsterdam-datasetversie bestaat al.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE scope_code = '0363' AND datasetversie = 'v20260805'
      AND NOT (status = 'actief' AND is_actief)
  ) THEN
    RAISE EXCEPTION 'Bekende Amsterdam-voorganger v20260805 is niet actief; handmatige diagnose vereist.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE scope_code = '0363' AND datasetversie = 'v20260808-directional-v3'
      AND (is_actief OR status NOT IN ('staging','gevalideerd'))
  ) THEN
    RAISE EXCEPTION 'Bestaande v3-dataset heeft onverwachte status of is actief.';
  END IF;
END
$guard$;
'''
if prepare_guard_old not in text:
    raise SystemExit('Getransformeerde prepare-guard wijkt onverwacht af.')
text = text.replace(prepare_guard_old, prepare_guard_new)

for forbidden in [
    '8973886061',
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
    'source_offset="$current"',
    'raw CSV-offset=$source_offset',
    "datasetversie NOT IN ('v20260805', 'v20260808-directional-v3')",
    "datasetversie = 'v20260805'",
    "NOT (status = 'actief' AND is_actief)",
]
for token in required:
    if token not in text:
        raise SystemExit(f'Verplichte v3-token ontbreekt na transformatie: {token}')

path.write_text(text, encoding='utf-8')
PY

chmod 700 "$TMP_SCRIPT"
exec bash "$TMP_SCRIPT" "$@"
