#!/usr/bin/env python3
"""Extracteer kleine officiële BAG XML-fixtures uit de gemeenteproef.

De volledige BAG-bronbestanden worden niet gepubliceerd. Per geselecteerde combinatie
van objecttype en leveringscategorie wordt maximaal één volledig recordfragment bewaard:
het directe omhullende element rond het BAG-object, inclusief voorkomenmetadata,
relaties en geometrie.
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
    "inactief:Pand",
    "inactief:Verblijfsobject",
    "inactief:Nummeraanduiding",
}

OPTIONAL = {
    "in_onderzoek:Pand",
    "in_onderzoek:Verblijfsobject",
    "in_onderzoek:Nummeraanduiding",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def namespace_uri(tag: str) -> str | None:
    return tag[1:].split("}", 1)[0] if tag.startswith("{") else None


def category_for(path: Path) -> str | None:
    normalized = "/" + path.as_posix()
    for category, markers in CATEGORY_MARKERS.items():
        if any(marker in normalized for marker in markers):
            return category
    return None


def write_fixture(
    wrapper: ET.Element,
    object_element: ET.Element,
    output: Path,
) -> dict[str, object]:
    payload = ET.tostring(wrapper, encoding="utf-8", xml_declaration=True)
    output.write_bytes(payload)
    return {
        "bestand": output.name,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "root": local_name(wrapper.tag),
        "root_namespace": namespace_uri(wrapper.tag),
        "object_root": local_name(object_element.tag),
        "object_namespace": namespace_uri(object_element.tag),
        "elementen": sum(1 for _ in wrapper.iter()),
        "heeft_gml": any(
            child.tag.startswith("{http://www.opengis.net/gml/3.2}")
            for child in wrapper.iter()
        ),
        "heeft_xlink": any(
            any(key.startswith("{http://www.w3.org/1999/xlink}") for key in child.attrib)
            for child in wrapper.iter()
        ),
        "heeft_voorkomen": any(local_name(child.tag) == "voorkomen" for child in wrapper.iter()),
    }


def main() -> int:
    if len(sys.argv) != 3:
        print("Gebruik: extract-officiele-fixtures.py <unpacked-proef-dir> <output-dir>", file=sys.stderr)
        return 2

    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)

    found: dict[str, dict[str, object]] = {}
    wanted = REQUIRED | OPTIONAL

    for xml_path in sorted(source.rglob("*.xml")):
        category = category_for(xml_path)
        if category is None:
            continue

        stack: list[ET.Element] = []
        active_capture: tuple[str, str, ET.Element, ET.Element] | None = None

        try:
            iterator = ET.iterparse(xml_path, events=("start", "end"))
            for event, element in iterator:
                if event == "start":
                    stack.append(element)
                    object_type = local_name(element.tag)
                    key = f"{category}:{object_type}"
                    if (
                        active_capture is None
                        and object_type in OBJECT_TYPES
                        and key in wanted
                        and key not in found
                        and len(stack) >= 2
                    ):
                        active_capture = (key, object_type, element, stack[-2])
                    continue

                if active_capture is not None:
                    key, object_type, object_element, wrapper = active_capture
                    if element is wrapper:
                        file_name = f"{category}-{object_type.lower()}.xml"
                        metadata = write_fixture(wrapper, object_element, output / file_name)
                        metadata["bronpad"] = str(xml_path.relative_to(source))
                        found[key] = metadata
                        active_capture = None
                        wrapper.clear()
                else:
                    element.clear()

                if not stack or stack[-1] is not element:
                    raise RuntimeError(f"Ongeldige XML-stack bij {xml_path}")
                stack.pop()
        except (ET.ParseError, RuntimeError) as exc:
            print(f"Waarschuwing: XML kon niet worden verwerkt: {xml_path}: {exc}", file=sys.stderr)

    missing_required = sorted(REQUIRED - found.keys())
    missing_optional = sorted(OPTIONAL - found.keys())
    manifest = {
        "fixture_contract": "BAG Extract v20200601 officiële gemeenteproef Assen 0106",
        "bronmap": str(source),
        "fixture_niveau": "directe omhulling van het BAG-object",
        "fixtures": dict(sorted(found.items())),
        "ontbrekend_verplicht": missing_required,
        "ontbrekend_optioneel": missing_optional,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary_lines = [
        "# Officiële BAG XML-fixtures",
        "",
        "De fixtures bevatten het directe omhullende record rond het BAG-object,",
        "zodat voorkomenmetadata, relaties en GML behouden blijven.",
        "",
        f"- Aangemaakt: {len(found)}",
        f"- Ontbrekend verplicht: {len(missing_required)}",
        f"- Ontbrekend optioneel: {len(missing_optional)}",
        "",
    ]
    for key, metadata in sorted(found.items()):
        summary_lines.append(
            f"- `{key}` → `{metadata['bestand']}` ({metadata['bytes']} bytes, "
            f"root={metadata['root']}, GML={metadata['heeft_gml']}, "
            f"XLink={metadata['heeft_xlink']}, voorkomen={metadata['heeft_voorkomen']})"
        )
    if missing_optional:
        summary_lines.extend([
            "",
            "## Niet aanwezig in dit officiële proefbestand",
            *[f"- `{key}`" for key in missing_optional],
        ])
    if missing_required:
        summary_lines.extend([
            "",
            "## Ontbrekend verplicht",
            *[f"- `{key}`" for key in missing_required],
        ])
    (output / "README.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    if missing_required:
        print("Ontbrekende verplichte fixtures: " + ", ".join(missing_required), file=sys.stderr)
        return 1

    if missing_optional:
        print("Optionele fixtures niet aangetroffen: " + ", ".join(missing_optional), file=sys.stderr)

    print(f"{len(found)} volledige officiële BAG-recordfixtures geëxtraheerd naar {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
