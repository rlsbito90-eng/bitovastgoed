#!/usr/bin/env python3
"""Extraheer de actuele Amsterdamse BAG-adresketen uit het landelijke BAG Extract.

De selectie is richtinggevoelig en voorkomt transitieve scope-uitwaaiing:
1. indexeer Woonplaats/OpenbareRuimte/Nummeraanduiding/VBO/Pand-relaties;
2. selecteer woonplaatsen Amsterdam en Weesp;
3. volg uitsluitend de adresketen naar buiten: Woonplaats -> OpenbareRuimte ->
   Nummeraanduiding -> Verblijfsobject -> Pand;
4. voeg daarnaast Panden met huidige/legacy Amsterdamse bronprefix 0363/0457 toe,
   zodat ook Panden zonder adresseerbaar VBO niet stil verdwijnen;
5. schrijf uitsluitend records waarvan de primaire identificatie expliciet is geselecteerd.

Hierdoor kan een VBO dat meerdere Panden raakt niet langer een volledige aangrenzende
municipale relatieclosure starten.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import time
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import BinaryIO, Iterator
from xml.etree import ElementTree as ET

SCOPE = "0363"
TARGET_WOONPLAATSEN = {"amsterdam", "weesp"}
PAND_SEED_PREFIXES = {"0363", "0457"}
HEARTBEAT_INTERVAL = 50_000
OBJECTTYPEN = {
    "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
    "Woonplaats", "Standplaats", "Ligplaats",
}
RELATIE_TAGS = {
    "PandRef": "pand",
    "NummeraanduidingRef": "nummeraanduiding",
    "OpenbareRuimteRef": "openbare_ruimte",
    "WoonplaatsRef": "woonplaats",
}


def log(message: str) -> None:
    print(f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] {message}", flush=True)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def norm(value: str | None) -> str:
    return (value or "").strip().casefold()


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


def record_metadata(xml: str) -> dict[str, object]:
    root = ET.fromstring(xml)
    primaire_identificatie: str | None = None
    objecttype = "Onbekend"
    refs: dict[str, set[str]] = defaultdict(set)
    woonplaats_naam: str | None = None

    for element in root.iter():
        naam = local_name(element.tag)
        tekst = (element.text or "").strip()
        if objecttype == "Onbekend" and naam in OBJECTTYPEN:
            objecttype = naam
        if naam.lower() == "identificatie" and primaire_identificatie is None and tekst:
            primaire_identificatie = tekst
        relatie = RELATIE_TAGS.get(naam)
        if relatie and tekst:
            refs[relatie].add(tekst)
        if objecttype == "Woonplaats" and naam.lower() == "naam" and tekst:
            woonplaats_naam = tekst

    return {
        "identificatie": primaire_identificatie,
        "objecttype": objecttype,
        "refs": {key: sorted(values) for key, values in refs.items()},
        "woonplaats_naam": woonplaats_naam,
    }


def scan_records(source: Path) -> Iterator[tuple[str, str, dict[str, object]]]:
    with zipfile.ZipFile(source) as archive:
        for bronpad, stream in iter_zip_xml(archive):
            log(f"Bronscan leest {bronpad}")
            for xml in iter_stand_xml(stream):
                yield bronpad, xml, record_metadata(xml)


def schrijf_metadata_index(source: Path, metadata_path: Path) -> int:
    bekeken = 0
    with metadata_path.open("w", encoding="utf-8") as handle:
        for _, _, metadata in scan_records(source):
            bekeken += 1
            handle.write(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n")
            if bekeken % HEARTBEAT_INTERVAL == 0:
                log(f"Index: {bekeken:,} records")
    log(f"Metadata-index gereed: {bekeken:,} records")
    return bekeken


def iter_metadata(metadata_path: Path) -> Iterator[dict[str, object]]:
    with metadata_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            yield json.loads(line)


def refs(metadata: dict[str, object], sleutel: str) -> set[str]:
    raw = metadata.get("refs")
    if not isinstance(raw, dict):
        return set()
    values = raw.get(sleutel, [])
    return {str(value) for value in values if str(value).strip()}


def primaire_id(metadata: dict[str, object]) -> str | None:
    value = metadata.get("identificatie")
    return str(value) if isinstance(value, str) and value.strip() else None


def bereken_directionele_selectie(metadata_path: Path) -> tuple[dict[str, set[str]], list[dict[str, int]]]:
    geselecteerd: dict[str, set[str]] = defaultdict(set)
    stappen: list[dict[str, int]] = []

    for metadata in iter_metadata(metadata_path):
        if metadata.get("objecttype") != "Woonplaats":
            continue
        identificatie = primaire_id(metadata)
        if identificatie and norm(metadata.get("woonplaats_naam") if isinstance(metadata.get("woonplaats_naam"), str) else None) in TARGET_WOONPLAATSEN:
            geselecteerd["Woonplaats"].add(identificatie)
    stappen.append({"stap": 1, "woonplaatsen": len(geselecteerd["Woonplaats"])})

    for metadata in iter_metadata(metadata_path):
        if metadata.get("objecttype") != "OpenbareRuimte":
            continue
        identificatie = primaire_id(metadata)
        if identificatie and refs(metadata, "woonplaats") & geselecteerd["Woonplaats"]:
            geselecteerd["OpenbareRuimte"].add(identificatie)
    stappen.append({"stap": 2, "openbare_ruimten": len(geselecteerd["OpenbareRuimte"])})

    for metadata in iter_metadata(metadata_path):
        if metadata.get("objecttype") != "Nummeraanduiding":
            continue
        identificatie = primaire_id(metadata)
        if identificatie and refs(metadata, "openbare_ruimte") & geselecteerd["OpenbareRuimte"]:
            geselecteerd["Nummeraanduiding"].add(identificatie)
    stappen.append({"stap": 3, "nummeraanduidingen": len(geselecteerd["Nummeraanduiding"])})

    for metadata in iter_metadata(metadata_path):
        objecttype = metadata.get("objecttype")
        if objecttype not in {"Verblijfsobject", "Standplaats", "Ligplaats"}:
            continue
        identificatie = primaire_id(metadata)
        if identificatie and refs(metadata, "nummeraanduiding") & geselecteerd["Nummeraanduiding"]:
            geselecteerd[str(objecttype)].add(identificatie)
    stappen.append({
        "stap": 4,
        "verblijfsobjecten": len(geselecteerd["Verblijfsobject"]),
        "standplaatsen": len(geselecteerd["Standplaats"]),
        "ligplaatsen": len(geselecteerd["Ligplaats"]),
    })

    for metadata in iter_metadata(metadata_path):
        if metadata.get("objecttype") != "Verblijfsobject":
            continue
        identificatie = primaire_id(metadata)
        if identificatie not in geselecteerd["Verblijfsobject"]:
            continue
        geselecteerd["Pand"].update(refs(metadata, "pand"))

    for metadata in iter_metadata(metadata_path):
        if metadata.get("objecttype") != "Pand":
            continue
        identificatie = primaire_id(metadata)
        if identificatie and any(identificatie.startswith(prefix) for prefix in PAND_SEED_PREFIXES):
            geselecteerd["Pand"].add(identificatie)
    stappen.append({"stap": 5, "panden": len(geselecteerd["Pand"])})

    return geselecteerd, stappen


def schrijf_subset(
    source: Path,
    output: Path,
    geselecteerd: dict[str, set[str]],
) -> tuple[int, int, Counter[str], Counter[str], Counter[str]]:
    objecttypen: Counter[str] = Counter()
    prefix_tellingen: Counter[str] = Counter()
    pand_prefix_tellingen: Counter[str] = Counter()
    geschreven = 0
    bekeken = 0
    zonder_identificatie = 0

    with output.open("w", encoding="utf-8") as handle:
        for bronpad, xml, metadata in scan_records(source):
            bekeken += 1
            objecttype = str(metadata.get("objecttype") or "Onbekend")
            identificatie = primaire_id(metadata)
            if not identificatie or identificatie not in geselecteerd.get(objecttype, set()):
                if identificatie is None:
                    zonder_identificatie += 1
                if bekeken % HEARTBEAT_INTERVAL == 0:
                    log(f"Subset: {bekeken:,} records bekeken; {geschreven:,} geschreven")
                continue

            prefix_tellingen[identificatie[:4]] += 1
            if objecttype == "Pand":
                pand_prefix_tellingen[identificatie[:4]] += 1
            objecttypen[objecttype] += 1
            handle.write(json.dumps({"bronpad": bronpad, "xml": xml}, ensure_ascii=False) + "\n")
            geschreven += 1
            if bekeken % HEARTBEAT_INTERVAL == 0:
                log(f"Subset: {bekeken:,} records bekeken; {geschreven:,} geschreven")

    log(f"Subset gereed: {bekeken:,} bekeken; {geschreven:,} geschreven")
    return geschreven, zonder_identificatie, objecttypen, prefix_tellingen, pand_prefix_tellingen


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
    geselecteerd: dict[str, set[str]] = defaultdict(set)
    stappen: list[dict[str, int]] = []
    geschreven = 0
    zonder_identificatie = 0
    objecttypen: Counter[str] = Counter()
    prefix_tellingen: Counter[str] = Counter()
    pand_prefix_tellingen: Counter[str] = Counter()

    try:
        with tempfile.TemporaryDirectory(prefix="bag-amsterdam-index-") as tmp:
            metadata_path = Path(tmp) / "metadata.ndjson"
            log("Start bronscan 1/2: relationele metadata-index")
            bekeken_records = schrijf_metadata_index(source, metadata_path)

            log("Bereken richtinggevoelige Amsterdam/Weesp-adresketen")
            geselecteerd, stappen = bereken_directionele_selectie(metadata_path)
            if not geselecteerd["Woonplaats"]:
                raise RuntimeError("Geen woonplaats Amsterdam of Weesp gevonden")
            if not geselecteerd["Pand"]:
                raise RuntimeError("Geen Amsterdamse Panden geselecteerd")

            log("Start bronscan 2/2: schrijf geografisch begrensde subset")
            geschreven, zonder_identificatie, objecttypen, prefix_tellingen, pand_prefix_tellingen = schrijf_subset(
                source, output, geselecteerd
            )
    except (ET.ParseError, zipfile.BadZipFile, OSError, RuntimeError, json.JSONDecodeError) as exc:
        parse_fouten.append(str(exc))

    afwijkende_pand_prefixen = {
        prefix: aantal
        for prefix, aantal in sorted(pand_prefix_tellingen.items())
        if prefix not in PAND_SEED_PREFIXES
    }
    rapport = {
        "scope_code": SCOPE,
        "strategie": "directionele_adresketen_woonplaats_scope_twee_bronpasses",
        "bron_scans": 2,
        "target_woonplaatsen": sorted(TARGET_WOONPLAATSEN),
        "pand_seed_prefixes": sorted(PAND_SEED_PREFIXES),
        "geindexeerde_records": bekeken_records,
        "selectiestappen": stappen,
        "geselecteerde_objecten": {key: len(value) for key, value in sorted(geselecteerd.items())},
        "geschreven_records": geschreven,
        "records_zonder_primaire_identificatie": zonder_identificatie,
        "objecttype_tellingen": dict(sorted(objecttypen.items())),
        "prefix_tellingen": dict(sorted(prefix_tellingen.items())),
        "pand_prefix_tellingen": dict(sorted(pand_prefix_tellingen.items())),
        "afwijkende_pand_prefixen": afwijkende_pand_prefixen,
        "doorlooptijd_seconden": round(time.monotonic() - start, 1),
        "parse_fouten": parse_fouten,
    }
    schrijf_rapport(report_path, rapport)

    if parse_fouten or geschreven == 0 or not pand_prefix_tellingen:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
