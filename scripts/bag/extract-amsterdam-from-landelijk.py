#!/usr/bin/env python3
"""Extraheer Amsterdam (0363) relatiebewust uit het landelijke BAG Extract.

De landelijke ZIP wordt niet volledig uitgepakt. XML-bestanden en geneste ZIP-bestanden
worden sequentieel gelezen. In meerdere passes ontstaat een relatieclosure rond alle
BAG-identificaties met prefix 0363. Alleen de uiteindelijke Amsterdam-subset wordt als
NDJSON geschreven voor de bestaande BAG-pipeline.
"""

from __future__ import annotations

import io
import json
import re
import shutil
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from typing import BinaryIO, Iterator
from xml.etree import ElementTree as ET

SCOPE = "0363"
MAX_CLOSURE_PASSES = 5
IDENTIFICATIE_PATTERN = re.compile(r"(?<!\d)\d{16}(?!\d)")


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def iter_stand_xml(stream: BinaryIO) -> Iterator[str]:
    in_stand = False
    depth = 0
    for event, element in ET.iterparse(stream, events=("start", "end")):
        naam = local_name(element.tag).lower()
        if event == "start":
            if in_stand:
                depth += 1
            elif naam == "stand":
                in_stand = True
                depth = 1
            continue
        if in_stand:
            depth -= 1
            if depth == 0:
                yield ET.tostring(element, encoding="unicode")
                in_stand = False
                element.clear()
            continue
        element.clear()


def iter_zip_xml(archive: zipfile.ZipFile, bronpad: str = "") -> Iterator[tuple[str, BinaryIO]]:
    for member in sorted(archive.infolist(), key=lambda item: item.filename):
        if member.is_dir():
            continue
        naam = member.filename
        pad = f"{bronpad}!{naam}" if bronpad else naam
        lower = naam.lower()
        if lower.endswith(".xml"):
            with archive.open(member) as stream:
                yield pad, stream
        elif lower.endswith(".zip"):
            with tempfile.NamedTemporaryFile(suffix=".zip") as tijdelijk:
                with archive.open(member) as source:
                    shutil.copyfileobj(source, tijdelijk, length=8 * 1024 * 1024)
                tijdelijk.flush()
                with zipfile.ZipFile(tijdelijk.name) as nested:
                    yield from iter_zip_xml(nested, pad)


def record_identifiers(xml: str) -> tuple[str | None, set[str]]:
    root = ET.fromstring(xml)
    primaire_identificatie: str | None = None
    alle_identificaties: set[str] = set()
    for element in root.iter():
        tekst = (element.text or "").strip()
        if not tekst:
            continue
        if local_name(element.tag).lower() == "identificatie" and primaire_identificatie is None:
            match = IDENTIFICATIE_PATTERN.search(tekst)
            if match:
                primaire_identificatie = match.group(0)
        alle_identificaties.update(IDENTIFICATIE_PATTERN.findall(tekst))
    return primaire_identificatie, alle_identificaties


def scan_records(source: Path) -> Iterator[tuple[str, str, str | None, set[str]]]:
    with zipfile.ZipFile(source) as archive:
        for bronpad, stream in iter_zip_xml(archive):
            for xml in iter_stand_xml(stream):
                primair, identifiers = record_identifiers(xml)
                yield bronpad, xml, primair, identifiers


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "Gebruik: extract-amsterdam-from-landelijk.py <landelijk.zip> <amsterdam.ndjson> <rapport.json>",
            file=sys.stderr,
        )
        return 2

    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    report_path = Path(sys.argv[3]).resolve()
    if not source.is_file():
        print(f"Bronbestand ontbreekt: {source}", file=sys.stderr)
        return 1

    geselecteerde_ids: set[str] = set()
    passes: list[dict[str, int]] = []
    parse_fouten: list[str] = []

    for pass_nummer in range(1, MAX_CLOSURE_PASSES + 1):
        toegevoegd: set[str] = set()
        bekeken = 0
        geraakt = 0
        try:
            for _, _, primair, identifiers in scan_records(source):
                bekeken += 1
                seed = bool(primair and primair.startswith(SCOPE))
                verbonden = bool(identifiers & geselecteerde_ids)
                if seed or verbonden or (primair in geselecteerde_ids if primair else False):
                    geraakt += 1
                    toegevoegd.update(identifiers)
                    if primair:
                        toegevoegd.add(primair)
        except (ET.ParseError, zipfile.BadZipFile, OSError) as exc:
            parse_fouten.append(f"pass {pass_nummer}: {exc}")
            break

        voor = len(geselecteerde_ids)
        geselecteerde_ids.update(toegevoegd)
        groei = len(geselecteerde_ids) - voor
        passes.append({
            "pass": pass_nummer,
            "bekeken_records": bekeken,
            "geraakte_records": geraakt,
            "nieuwe_identificaties": groei,
            "totaal_geselecteerde_identificaties": len(geselecteerde_ids),
        })
        if groei == 0 and pass_nummer > 1:
            break

    output.parent.mkdir(parents=True, exist_ok=True)
    objecttypen: Counter[str] = Counter()
    prefix_tellingen: Counter[str] = Counter()
    geschreven = 0
    zonder_identificatie = 0

    if not parse_fouten:
        with output.open("w", encoding="utf-8") as handle:
            try:
                for bronpad, xml, primair, identifiers in scan_records(source):
                    if not (identifiers & geselecteerde_ids or (primair in geselecteerde_ids if primair else False)):
                        continue
                    if primair:
                        prefix_tellingen[primair[:4]] += 1
                    else:
                        zonder_identificatie += 1
                    root = ET.fromstring(xml)
                    objecttype = next(
                        (local_name(el.tag) for el in root.iter() if local_name(el.tag) in {
                            "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
                            "Woonplaats", "Standplaats", "Ligplaats"
                        }),
                        "Onbekend",
                    )
                    objecttypen[objecttype] += 1
                    handle.write(json.dumps({"bronpad": bronpad, "xml": xml}, ensure_ascii=False) + "\n")
                    geschreven += 1
            except (ET.ParseError, zipfile.BadZipFile, OSError) as exc:
                parse_fouten.append(f"output: {exc}")

    rapport = {
        "scope_code": SCOPE,
        "strategie": "meerpassige_relatieclosure_streamend",
        "max_closure_passes": MAX_CLOSURE_PASSES,
        "passes": passes,
        "geselecteerde_identificaties": len(geselecteerde_ids),
        "geschreven_records": geschreven,
        "records_zonder_primaire_identificatie": zonder_identificatie,
        "objecttype_tellingen": dict(sorted(objecttypen.items())),
        "prefix_tellingen": dict(sorted(prefix_tellingen.items())),
        "parse_fouten": parse_fouten,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(rapport, ensure_ascii=False))

    if parse_fouten or geschreven == 0 or prefix_tellingen.get(SCOPE, 0) == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
