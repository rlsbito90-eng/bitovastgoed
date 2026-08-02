#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-bag-broninspectie}"
mkdir -p "$OUT_DIR/downloads" "$OUT_DIR/unpacked"

XSD_URL="https://developer.kadaster.nl/schemas/lvbag-extract-v20200601.zip"
PROEF_URL="https://www.kadaster.nl/documents/1953498/2762071/Proefbestand%2Bgemeente.zip/24446fad-f8a8-dec5-7745-f050d7c1976b?t=1639746514279"

fetch() {
  local url="$1"
  local target="$2"
  local tmp="${target}.part"

  rm -f "$tmp"

  if curl --ipv4 --fail --location --silent --show-error \
    --retry 8 --retry-all-errors --retry-delay 5 \
    --connect-timeout 60 --max-time 900 \
    "$url" --output "$tmp"; then
    mv "$tmp" "$target"
    return 0
  fi

  echo "curl-download mislukt; probeer wget-fallback voor $url" >&2
  rm -f "$tmp"
  wget --inet4-only --quiet \
    --tries=5 --timeout=90 --waitretry=5 \
    --output-document="$tmp" "$url"
  mv "$tmp" "$target"
}

fetch "$XSD_URL" "$OUT_DIR/downloads/lvbag-extract-v20200601.zip"
fetch "$PROEF_URL" "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip"

file "$OUT_DIR"/downloads/*.zip > "$OUT_DIR/file-types.txt"
sha256sum "$OUT_DIR"/downloads/*.zip > "$OUT_DIR/sha256.txt"
unzip -t "$OUT_DIR/downloads/lvbag-extract-v20200601.zip" > "$OUT_DIR/xsd-zip-test.txt"
unzip -t "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip" > "$OUT_DIR/proef-zip-test.txt"
unzip -Z1 "$OUT_DIR/downloads/lvbag-extract-v20200601.zip" | sort > "$OUT_DIR/xsd-inhoud.txt"

rm -rf "$OUT_DIR/unpacked/xsd" "$OUT_DIR/unpacked/proef"
unzip -q "$OUT_DIR/downloads/lvbag-extract-v20200601.zip" -d "$OUT_DIR/unpacked/xsd"

python3 - "$OUT_DIR/downloads/proefbestand-gemeente-assen-0106.zip" "$OUT_DIR/unpacked/proef" <<'PY'
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    root = destination.resolve()
    for member in archive.infolist():
        output = (destination / member.filename).resolve()
        if output != root and root not in output.parents:
            raise RuntimeError(f"Onveilig ZIP-pad geweigerd: {member.filename}")
    archive.extractall(destination)


def unpack_recursive(zip_path: Path, destination: Path, seen: set[Path]) -> None:
    resolved = zip_path.resolve()
    if resolved in seen:
        return
    seen.add(resolved)
    with zipfile.ZipFile(zip_path) as archive:
        safe_extract(archive, destination)
    for nested in sorted(destination.rglob("*.zip")):
        nested_destination = nested.parent / "__nested__" / nested.stem
        unpack_recursive(nested, nested_destination, seen)


unpack_recursive(source, target, set())
PY

find "$OUT_DIR/unpacked" -type f -printf '%P\t%s\n' | sort > "$OUT_DIR/bestanden-en-grootte.tsv"
find "$OUT_DIR/unpacked/proef" -type f -printf '%P\n' | sort > "$OUT_DIR/proef-inhoud.txt"

python3 - "$OUT_DIR/unpacked" "$OUT_DIR/namespaces.txt" "$OUT_DIR/objectelementen.txt" <<'PY'
from __future__ import annotations

import collections
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(sys.argv[1])
namespaces_path = Path(sys.argv[2])
objects_path = Path(sys.argv[3])

object_names = {
    "Pand",
    "Verblijfsobject",
    "Nummeraanduiding",
    "OpenbareRuimte",
    "Woonplaats",
    "Standplaats",
    "Ligplaats",
}

namespaces: set[tuple[str, str]] = set()
object_counts: collections.Counter[str] = collections.Counter()
parse_errors: list[str] = []

for path in sorted(root.rglob("*")):
    if not path.is_file() or path.suffix.lower() not in {".xml", ".xsd"}:
        continue
    try:
        for event, value in ET.iterparse(path, events=("start-ns", "start")):
            if event == "start-ns":
                prefix, uri = value
                namespaces.add((prefix or "(default)", uri))
                continue
            local_name = value.tag.rsplit("}", 1)[-1]
            if local_name in object_names:
                object_counts[local_name] += 1
            value.clear()
    except ET.ParseError as exc:
        parse_errors.append(f"{path.relative_to(root)}\t{exc}")

with namespaces_path.open("w", encoding="utf-8") as handle:
    for prefix, uri in sorted(namespaces):
        handle.write(f"{prefix}\t{uri}\n")
    if parse_errors:
        handle.write("# PARSE_ERRORS\n")
        for error in parse_errors:
            handle.write(f"{error}\n")

with objects_path.open("w", encoding="utf-8") as handle:
    for name in sorted(object_names):
        handle.write(f"{object_counts[name]}\t{name}\n")
PY

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
  echo "- XML-proefbestanden na recursief uitpakken: $(find "$OUT_DIR/unpacked/proef" -type f -iname '*.xml' | wc -l)"
  echo "- Geneste ZIP-bestanden: $(find "$OUT_DIR/unpacked/proef" -type f -iname '*.zip' | wc -l)"
  echo "- Totaal uitgepakte bestanden: $(find "$OUT_DIR/unpacked" -type f | wc -l)"
  echo
  echo '## BAG-objectelementen'
  echo '```'
  cat "$OUT_DIR/objectelementen.txt"
  echo '```'
} > "$OUT_DIR/rapport.md"

printf 'Inspectie afgerond. Rapport: %s\n' "$OUT_DIR/rapport.md"
