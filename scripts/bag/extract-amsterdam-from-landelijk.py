#!/usr/bin/env python3
"""Extraheer Amsterdam (0363) relatiebewust uit het landelijke BAG Extract.

De landelijke bron wordt nog maar twee keer XML-inhoudelijk gescand:
1. bouw een compacte metadata-index met primaire en gerelateerde BAG-identificaties;
2. schrijf na de relatieclosure uitsluitend de geselecteerde records naar NDJSON.

De closurepasses lezen de lokale metadata-index en niet opnieuw het landelijke ZIP-bestand.
Geneste ZIP-bestanden worden per bronscan sequentieel naar een tijdelijk bestand gekopieerd,
zodat ze nooit volledig in het geheugen worden geladen.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
import time
import zipfile
from collections import Counter
from pathlib import Path
from typing import BinaryIO, Iterator, TextIO
from xml.etree import ElementTree as ET

SCOPE = "0363"
MAX_CLOSURE_PASSES = 6
HEARTBEAT_INTERVAL = 50_000
IDENTIFICATIE_PATTERN = re.compile(r"(?<!\d)\d{16}(?!\d)")
OBJECTTYPEN = {
    "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
    "Woonplaats", "Standplaats", "Ligplaats",
}


def log(message: str) -> None:
    print(f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] {message}", flush=True)


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
    """Lees XML en geneste ZIPs sequentieel zonder hele nested archives in RAM."""
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


def record_metadata(xml: str) -> tuple[str | None, set[str], str]:
    root = ET.fromstring(xml)
    primaire_identificatie: str | None = None
    alle_identificaties: set[str] = set()
    objecttype = "Onbekend"
    for element in root.iter():
        naam = local_name(element.tag)
        if objecttype == "Onbekend" and naam in OBJECTTYPEN:
            objecttype = naam
        tekst = (element.text or "").strip()
        if not tekst:
            continue
        if naam.lower() == "identificatie" and primaire_identificatie is None:
            match = IDENTIFICATIE_PATTERN.search(tekst)
            if match:
                primaire_identificatie = match.group(0)
        alle_identificaties.update(IDENTIFICATIE_PATTERN.findall(tekst))
    return primaire_identificatie, alle_identificaties, objecttype


def scan_records(source: Path) -> Iterator[tuple[str, str, str | None, set[str], str]]:
    with zipfile.ZipFile(source) as archive:
        for bronpad, stream in iter_zip_xml(archive):
            log(f"Bronscan leest {bronpad}")
            for xml in iter_stand_xml(stream):
                primair, identifiers, objecttype = record_metadata(xml)
                yield bronpad, xml, primair, identifiers, objecttype


def schrijf_metadata_index(source: Path, metadata_path: Path) -> tuple[int, set[str]]:
    bekeken = 0
    geselecteerde_ids: set[str] = set()
    with metadata_path.open("w", encoding="utf-8") as handle:
        for _, _, primair, identifiers, _ in scan_records(source):
            bekeken += 1
            if primair and primair.startswith(SCOPE):
                geselecteerde_ids.add(primair)
                geselecteerde_ids.update(identifiers)
            handle.write(json.dumps([primair, sorted(identifiers)], separators=(",", ":")) + "\n")
            if bekeken % HEARTBEAT_INTERVAL == 0:
                log(
                    f"Index: {bekeken:,} records; "
                    f"{len(geselecteerde_ids):,} seed/gerelateerde identificaties"
                )
    log(f"Metadata-index gereed: {bekeken:,} records")
    return bekeken, geselecteerde_ids


def lees_metadata_regel(line: str) -> tuple[str | None, set[str]]:
    primair, identifiers = json.loads(line)
    return primair, set(identifiers)


def bereken_relatieclosure(
    metadata_path: Path,
    geselecteerde_ids: set[str],
) -> list[dict[str, int]]:
    passes: list[dict[str, int]] = []
    for pass_nummer in range(1, MAX_CLOSURE_PASSES + 1):
        toegevoegd: set[str] = set()
        bekeken = 0
        geraakt = 0
        with metadata_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                bekeken += 1
                primair, identifiers = lees_metadata_regel(line)
                verbonden = bool(identifiers & geselecteerde_ids)
                primair_geselecteerd = bool(primair and primair in geselecteerde_ids)
                if verbonden or primair_geselecteerd:
                    geraakt += 1
                    toegevoegd.update(identifiers)
                    if primair:
                        toegevoegd.add(primair)
                if bekeken % (HEARTBEAT_INTERVAL * 4) == 0:
                    log(f"Closurepass {pass_nummer}: {bekeken:,} metadatarecords bekeken")

        voor = len(geselecteerde_ids)
        geselecteerde_ids.update(toegevoegd)
        groei = len(geselecteerde_ids) - voor
        resultaat = {
            "pass": pass_nummer,
            "bekeken_records": bekeken,
            "geraakte_records": geraakt,
            "nieuwe_identificaties": groei,
            "totaal_geselecteerde_identificaties": len(geselecteerde_ids),
        }
        passes.append(resultaat)
        log(
            f"Closurepass {pass_nummer}: {geraakt:,} geraakt, "
            f"{groei:,} nieuwe IDs, totaal {len(geselecteerde_ids):,}"
        )
        if groei == 0:
            break
    return passes


def schrijf_subset(
    source: Path,
    output: Path,
    geselecteerde_ids: set[str],
) -> tuple[int, int, Counter[str], Counter[str]]:
    objecttypen: Counter[str] = Counter()
    prefix_tellingen: Counter[str] = Counter()
    geschreven = 0
    bekeken = 0
    zonder_identificatie = 0

    with output.open("w", encoding="utf-8") as handle:
        for bronpad, xml, primair, identifiers, objecttype in scan_records(source):
            bekeken += 1
            if not (identifiers & geselecteerde_ids or (primair in geselecteerde_ids if primair else False)):
                if bekeken % HEARTBEAT_INTERVAL == 0:
                    log(f"Subset: {bekeken:,} records bekeken; {geschreven:,} geschreven")
                continue
            if primair:
                prefix_tellingen[primair[:4]] += 1
            else:
                zonder_identificatie += 1
            objecttypen[objecttype] += 1
            handle.write(json.dumps({"bronpad": bronpad, "xml": xml}, ensure_ascii=False) + "\n")
            geschreven += 1
            if bekeken % HEARTBEAT_INTERVAL == 0:
                log(f"Subset: {bekeken:,} records bekeken; {geschreven:,} geschreven")

    log(f"Subset gereed: {bekeken:,} bekeken; {geschreven:,} geschreven")
    return geschreven, zonder_identificatie, objecttypen, prefix_tellingen


def schrijf_rapport(report_path: Path, rapport: dict) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(rapport, ensure_ascii=False), flush=True)


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

    output.parent.mkdir(parents=True, exist_ok=True)
    parse_fouten: list[str] = []
    start = time.monotonic()
    bekeken_records = 0
    geselecteerde_ids: set[str] = set()
    passes: list[dict[str, int]] = []
    geschreven = 0
    zonder_identificatie = 0
    objecttypen: Counter[str] = Counter()
    prefix_tellingen: Counter[str] = Counter()

    try:
        with tempfile.TemporaryDirectory(prefix="bag-amsterdam-index-") as tmp:
            metadata_path = Path(tmp) / "metadata.ndjson"
            log("Start bronscan 1/2: compacte metadata-index")
            bekeken_records, geselecteerde_ids = schrijf_metadata_index(source, metadata_path)
            if not geselecteerde_ids:
                raise RuntimeError("Geen Amsterdamse seed-identificaties met prefix 0363 gevonden")

            log("Start relatieclosure op lokale metadata-index")
            passes = bereken_relatieclosure(metadata_path, geselecteerde_ids)

            log("Start bronscan 2/2: schrijf geselecteerde Amsterdam-subset")
            geschreven, zonder_identificatie, objecttypen, prefix_tellingen = schrijf_subset(
                source, output, geselecteerde_ids
            )
    except (ET.ParseError, zipfile.BadZipFile, OSError, RuntimeError, json.JSONDecodeError) as exc:
        parse_fouten.append(str(exc))

    rapport = {
        "scope_code": SCOPE,
        "strategie": "metadata_index_relatieclosure_twee_bronpasses",
        "bron_scans": 2,
        "max_closure_passes": MAX_CLOSURE_PASSES,
        "geindexeerde_records": bekeken_records,
        "passes": passes,
        "geselecteerde_identificaties": len(geselecteerde_ids),
        "geschreven_records": geschreven,
        "records_zonder_primaire_identificatie": zonder_identificatie,
        "objecttype_tellingen": dict(sorted(objecttypen.items())),
        "prefix_tellingen": dict(sorted(prefix_tellingen.items())),
        "doorlooptijd_seconden": round(time.monotonic() - start, 1),
        "parse_fouten": parse_fouten,
    }
    schrijf_rapport(report_path, rapport)

    if parse_fouten or geschreven == 0 or prefix_tellingen.get(SCOPE, 0) == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
