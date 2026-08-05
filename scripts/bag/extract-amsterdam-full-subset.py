#!/usr/bin/env python3
"""Schrijf volledige BAG-standrecords voor de gevalideerde Amsterdam-closure.

Het script downloadt niets en leest de officiële landelijke ZIP inclusief geneste ZIP's
sequentieel. Een record wordt geselecteerd wanneer de primaire identificatie of één van
zijn gerelateerde identificaties in de gevalideerde selectieset voorkomt.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

VERWACHTE_BRON_SHA256 = "fe2c5b7d7a264dd74ca7bfee72e7edd07d43dd99a90a34c8317e21ab6d79335c"
ID = re.compile(r"(?<!\d)\d{16}(?!\d)")
OBJECTTYPEN = {
    "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
    "Woonplaats", "Standplaats", "Ligplaats",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def bestand_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def iter_stand_xml(stream):
    in_stand = False
    depth = 0
    for event, element in ET.iterparse(stream, events=("start", "end")):
        name = local_name(element.tag).lower()
        if event == "start":
            if in_stand:
                depth += 1
            elif name == "stand":
                in_stand = True
                depth = 1
            continue
        if in_stand:
            depth -= 1
            if depth == 0:
                yield ET.tostring(element, encoding="unicode")
                in_stand = False
                element.clear()
        else:
            element.clear()


def iter_zip_xml(archive: zipfile.ZipFile, prefix: str = ""):
    for member in sorted(archive.infolist(), key=lambda item: item.filename):
        if member.is_dir():
            continue
        path = f"{prefix}!{member.filename}" if prefix else member.filename
        lower = member.filename.lower()
        if lower.endswith(".xml"):
            with archive.open(member) as stream:
                yield path, stream
        elif lower.endswith(".zip"):
            with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
                with archive.open(member) as source:
                    shutil.copyfileobj(source, tmp, length=8 * 1024 * 1024)
                tmp.flush()
                with zipfile.ZipFile(tmp.name) as nested:
                    yield from iter_zip_xml(nested, path)


def metadata(xml: str):
    root = ET.fromstring(xml)
    primary = None
    identifiers: set[str] = set()
    objecttype = "Onbekend"
    for element in root.iter():
        name = local_name(element.tag)
        if objecttype == "Onbekend" and name in OBJECTTYPEN:
            objecttype = name
        text = (element.text or "").strip()
        if not text:
            continue
        if primary is None and name.lower() == "identificatie":
            match = ID.search(text)
            if match:
                primary = match.group(0)
        identifiers.update(ID.findall(text))
    return primary, identifiers, objecttype


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bronbestand", type=Path)
    parser.add_argument("selectiebestand", type=Path)
    parser.add_argument("closurebewijs", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--verwachte-hash", default=VERWACHTE_BRON_SHA256)
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bewijs_path = args.output.with_suffix(".bewijs.json")

    def stop(code: str, reason: str, extra: dict | None = None) -> int:
        payload = {"status": "stop", "code": code, "reden": reason, "database_write_uitgevoerd": False}
        if extra:
            payload.update(extra)
        bewijs_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"STOP {code}: {reason}", file=sys.stderr)
        return 1

    if not args.bronbestand.is_file():
        return stop("bron_ontbreekt", str(args.bronbestand))
    measured = bestand_sha256(args.bronbestand)
    if measured != args.verwachte_hash:
        return stop("bron_hash_drift", f"{measured} != {args.verwachte_hash}")

    closure = json.loads(args.closurebewijs.read_text(encoding="utf-8"))
    if closure.get("status") != "closure_validated":
        return stop("closure_niet_gevalideerd", str(closure.get("status")))
    expected_records = int(closure.get("geselecteerdeRecords", 0))
    selection = {line.strip() for line in args.selectiebestand.read_text(encoding="utf-8").splitlines() if line.strip()}
    if not selection:
        return stop("lege_selectie", "selectiebestand is leeg")
    selection_checksum = hashlib.sha256("\n".join(sorted(selection)).encode()).hexdigest()
    if selection_checksum != closure.get("selectieChecksum"):
        return stop("selectie_hash_drift", f"{selection_checksum} != {closure.get('selectieChecksum')}")

    read = written = without_primary = 0
    parse_errors: list[str] = []
    objecttypes: Counter[str] = Counter()
    prefixes: Counter[str] = Counter()
    with args.output.open("w", encoding="utf-8") as target:
        try:
            with zipfile.ZipFile(args.bronbestand) as archive:
                for source_path, stream in iter_zip_xml(archive):
                    try:
                        for xml in iter_stand_xml(stream):
                            read += 1
                            primary, identifiers, objecttype = metadata(xml)
                            if primary is None:
                                without_primary += 1
                            if not ((primary and primary in selection) or identifiers.intersection(selection)):
                                continue
                            target.write(json.dumps({"bronpad": source_path, "xml": xml}, ensure_ascii=False) + "\n")
                            written += 1
                            objecttypes[objecttype] += 1
                            if primary:
                                prefixes[primary[:4]] += 1
                            if written % 50_000 == 0:
                                print(f"{written:,} geselecteerde records geschreven", flush=True)
                    except (ET.ParseError, OSError) as exc:
                        parse_errors.append(f"{source_path}: {exc}")
        except (zipfile.BadZipFile, OSError) as exc:
            parse_errors.append(str(exc))

    proof = {
        "status": "full_subset_validated",
        "contractversie": "bag-amsterdam-full-subset/2",
        "bron_sha256": measured,
        "selectieChecksum": selection_checksum,
        "geselecteerdeIds": len(selection),
        "verwachteRecords": expected_records,
        "standrecords_gelezen": read,
        "records_geschreven": written,
        "records_zonder_primaire_identificatie": without_primary,
        "objecttypen": dict(sorted(objecttypes.items())),
        "prefixverdeling": dict(sorted(prefixes.items())),
        "parse_fouten": parse_errors,
        "output_sha256": bestand_sha256(args.output),
        "output_bytes": args.output.stat().st_size,
        "database_write_uitgevoerd": False,
    }
    if parse_errors:
        proof.update(status="stop", code="parsefout")
    elif written == 0:
        proof.update(status="stop", code="geen_amsterdamrecords")
    elif expected_records <= 0 or written != expected_records:
        proof.update(status="stop", code="recordtelling_wijkt_af")
    bewijs_path.write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if proof["status"] != "full_subset_validated":
        print(json.dumps(proof, indent=2), file=sys.stderr)
        return 1
    print(f"full-subset gevalideerd: {written:,} records", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
