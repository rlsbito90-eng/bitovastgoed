#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-bag-broninspectie}"
mkdir -p "$OUT_DIR/downloads" "$OUT_DIR/unpacked"

XSD_URL="https://developer.kadaster.nl/schemas/lvbag-extract-v20200601.zip"
PROEF_URL="https://www.kadaster.nl/documents/1953498/2762071/Proefbestand%2Bgemeente.zip/24446fad-f8a8-dec5-7745-f050d7c1976b?t=1639746514279"

fetch() {
  local url="$1"
  local target="$2"
  curl --fail --location --silent --show-error \
    --retry 4 --retry-delay 3 --connect-timeout 20 --max-time 300 \
    "$url" --output "$target"
}

fetch "$XSD_URL" "$OUT_DIR/downloads/lvbag-extract-v20200601.zip"
fetch "$PROEF_URL" "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip"

file "$OUT_DIR"/downloads/*.zip > "$OUT_DIR/file-types.txt"
sha256sum "$OUT_DIR"/downloads/*.zip > "$OUT_DIR/sha256.txt"
unzip -t "$OUT_DIR/downloads/lvbag-extract-v20200601.zip" > "$OUT_DIR/xsd-zip-test.txt"
unzip -t "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip" > "$OUT_DIR/proef-zip-test.txt"
unzip -Z1 "$OUT_DIR/downloads/lvbag-extract-v20200601.zip" | sort > "$OUT_DIR/xsd-inhoud.txt"
unzip -Z1 "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip" | sort > "$OUT_DIR/proef-inhoud.txt"

unzip -q "$OUT_DIR/downloads/lvbag-extract-v20200601.zip" -d "$OUT_DIR/unpacked/xsd"
unzip -q "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip" -d "$OUT_DIR/unpacked/proef"

find "$OUT_DIR/unpacked" -type f -printf '%P\t%s\n' | sort > "$OUT_DIR/bestanden-en-grootte.tsv"
find "$OUT_DIR/unpacked/xsd" -type f \( -iname '*.xsd' -o -iname '*.xml' \) -print0 \
  | xargs -0 -r grep -hEo 'targetNamespace="[^"]+"|xmlns(:[A-Za-z0-9_-]+)?="[^"]+"' \
  | sort -u > "$OUT_DIR/namespaces.txt"

find "$OUT_DIR/unpacked/proef" -type f -iname '*.xml' -print0 \
  | xargs -0 -r grep -hEo '<[A-Za-z0-9_-]+:(Pand|Verblijfsobject|Nummeraanduiding|OpenbareRuimte|Woonplaats|Standplaats|Ligplaats)([^A-Za-z0-9_-]|>)' \
  | sed -E 's/[<(>].*//g' | sort | uniq -c > "$OUT_DIR/objectelementen.txt" || true

{
  echo '# BAG officiële broninspectie'
  echo
  echo "Gegenereerd: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo
  echo '## Bronnen'
  echo "- XSD-set: $XSD_URL"
  echo "- Gemeenteproefbestand Assen (0106): $PROEF_URL"
  echo
  echo '## SHA-256'
  echo '```'
  cat "$OUT_DIR/sha256.txt"
  echo '```'
  echo
  echo '## Bestandstypen'
  echo '```'
  cat "$OUT_DIR/file-types.txt"
  echo '```'
  echo
  echo '## Aantallen'
  echo "- XSD-bestanden: $(find "$OUT_DIR/unpacked/xsd" -type f -iname '*.xsd' | wc -l)"
  echo "- XML-proefbestanden: $(find "$OUT_DIR/unpacked/proef" -type f -iname '*.xml' | wc -l)"
  echo "- Totaal uitgepakte bestanden: $(find "$OUT_DIR/unpacked" -type f | wc -l)"
} > "$OUT_DIR/rapport.md"

printf 'Inspectie afgerond. Rapport: %s\n' "$OUT_DIR/rapport.md"
