#!/usr/bin/env python3
"""Extracteer kleine officiële BAG XML-fixtures uit de recursief uitgepakte gemeenteproef.

De volledige BAG-bronbestanden worden niet gepubliceerd. Per geselecteerde combinatie
van objecttype en leveringscategorie wordt maximaal één compleet XML-element bewaard.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

OBJECT_TYPES = (
    "Pand",
    "Verblijfsobject",
    "Nummeraanduiding",
    "OpenbareRuimte",
    "Woonplaats",
    "Standplaats",
    "Ligplaats",
)

CATEGORY_MARKERS = {
    "actief": ("/0106PND", "/0106VBO", "/0106NUM", "/0106OPR", "/0106WPL", "/0106STA", "/0106LIG"),
    "in_onderzoek": ("/0106IO",),
    "inactief": ("/0106IA",),
    "niet_bag": ("/0106NB",),
}

REQUIRED = {
    *(f"actief:{object_type}" for object_type in OBJECT_TYPES),
    "in_onderzoek:Pand",
    "in_onderzoek:Verblijfsobject",
    "in_onderzoek:Nummeraanduiding",
    "inactief:Pand",
    "inactief:Verblijfsobject",
    "inactief:Nummeraanduiding",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def category_for(path: Path) -> str | None:
    normalized = "/" + path.as_posix()
    for category, markers in CATEGORY_MARKERS.items():
        if any(marker in normalized for marker in markers):
            return category
    return None


def write_fixture(element: ET.Element, output: Path) -> dict[str, object]:
    payload = ET.tostring(element, encoding="utf-8", xml_declaration=True)
    output.write_bytes(payload)
    return {
        "bestand": output.name,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "root": local_name(element.tag),
        "namespace": element.tag[1:].split("}", 1)[0] if element.tag.startswith("{") else None,
        "elementen": sum(1 for _ in element.iter()),
        "heeft_gml": any(
            child.tag.startswith("{http://www.opengis.net/gml/3.2}")
            for child in element.iter()
        ),
        "heeft_xlink": any(
            any(key.startswith("{http://www.w3.org/1999/xlink}") for key in child.attrib)
            for child in element.iter()
        ),
    }


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: extract-officiele-fixtures.py <unpacked-proef-dir> <output-dir>", file=sys.stderr)
        return 2

    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)

    found: dict[str, dict[str, object]] = {}

    for xml_path in sorted(source.rglob("*.xml")):
        category = category_for(xml_path)
        if category is None:
            continue

        try:
            iterator = ET.iterparse(xml_path, events=("end",))
            for _, element in iterator:
                object_type = local_name(element.tag)
                key = f"{category}:{object_type}"
                should_capture = (
                    object_type in OBJECT_TYPES
                    and key not in found
                    and (key in REQUIRED or category == "actief")
                )

                if should_capture:
                    file_name = f"{category}-{object_type.lower()}.xml"
                    metadata = write_fixture(element, output / file_name)
                    metadata["bronpad"] = str(xml_path.relative_to(source))
                    found[key] = metadata

                element.clear()

                if REQUIRED.issubset(found):
                    break
        except ET.ParseError as exc:
            print(f"Waarschuwing: XML kon niet worden gelezen: {xml_path}: {exc}", file=sys.stderr)

        if REQUIRED.issubset(found):
            break

    missing = sorted(REQUIRED - found.keys())
    manifest = {
        "fixture_contract": "BAG Extract v20200601 officiële gemeenteproef Assen 0106",
        "bronmap": str(source),
        "fixtures": dict(sorted(found.items())),
        "ontbrekend": missing,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary_lines = [
        "# Officiële BAG XML-fixtures",
        "",
        f"- Aangemaakt: {len(found)}",
        f"- Ontbrekend: {len(missing)}",
        "",
    ]
    for key, metadata in sorted(found.items()):
        summary_lines.append(
            f"- `{key}` → `{metadata['bestand']}` ({metadata['bytes']} bytes, "
            f"GML={metadata['heeft_gml']}, XLink={metadata['heeft_xlink']})"
        )
    if missing:
        summary_lines.extend(["", "## Ontbrekend", *[f"- `{key}`" for key in missing]])
    (output / "README.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    if missing:
        print("Ontbrekende verplichte fixtures: " + ", ".join(missing), file=sys.stderr)
        return 1

    print(f"{len(found)} officiële BAG-fixtures geëxtraheerd naar {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
