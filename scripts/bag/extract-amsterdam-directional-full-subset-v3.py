#!/usr/bin/env python3
"""Extraheer BAG-standrecords uitsluitend op exact geselecteerde (objecttype, identificatie)-sleutels.

Deze extractor is bedoeld voor de bewezen metadata-v3 Amsterdam/Weesp-selectie. Hij downloadt
niets en schrijft niets naar een database. Anders dan de oude closure-extractor selecteert hij
nooit op gerelateerde identifiers; alleen de primaire sleutel van het BAG-object mag matchen.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

OBJECTTYPEN = {
    "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
    "Woonplaats", "Standplaats", "Ligplaats",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def iter_stand_elements(stream):
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
                yield element
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


def primary_key(stand: ET.Element) -> tuple[str, str] | None:
    objecttype: str | None = None
    primary: str | None = None
    for element in stand.iter():
        name = local_name(element.tag)
        text = (element.text or "").strip()
        if objecttype is None and name in OBJECTTYPEN:
            objecttype = name
        if primary is None and name.lower() == "identificatie" and text:
            primary = text
        if objecttype is not None and primary is not None:
            break
    if objecttype is None or primary is None:
        return None
    return objecttype, primary


def load_selection(path: Path) -> set[tuple[str, str]]:
    selected: set[tuple[str, str]] = set()
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"selectieregel {line_number} is geen geldige JSON: {exc}") from exc
            if not isinstance(row, list) or len(row) != 2:
                raise ValueError(f"selectieregel {line_number} moet [objecttype, identificatie] zijn")
            objecttype, identificatie = row
            if objecttype not in OBJECTTYPEN:
                raise ValueError(f"selectieregel {line_number} heeft onverwacht objecttype {objecttype!r}")
            if not isinstance(identificatie, str) or not identificatie.strip():
                raise ValueError(f"selectieregel {line_number} mist identificatie")
            selected.add((objecttype, identificatie.strip()))
    if not selected:
        raise ValueError("directionele selectie is leeg")
    return selected


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bronbestand", type=Path)
    parser.add_argument("selectiebestand", type=Path)
    parser.add_argument("selectierapport", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--verwachte-hash")
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    proof_path = args.output.with_suffix(".bewijs.json")

    def stop(code: str, reason: str, extra: dict | None = None) -> int:
        payload = {
            "status": "directional_full_subset_blocked",
            "code": code,
            "reden": reason,
            "database_write_uitgevoerd": False,
            "supabase_benaderd": False,
            "productie_benaderd": False,
        }
        if extra:
            payload.update(extra)
        proof_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"STOP {code}: {reason}", file=sys.stderr)
        return 1

    try:
        selection = load_selection(args.selectiebestand)
    except (OSError, ValueError) as exc:
        return stop("selectie_ongeldig", str(exc))

    try:
        selection_report = json.loads(args.selectierapport.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return stop("selectierapport_ongeldig", str(exc))

    if selection_report.get("status") != "amsterdam_directionele_metadata_selectie_validated":
        return stop("selectierapport_niet_groen", str(selection_report.get("status")))
    if selection_report.get("metadata_schema_version") != 3:
        return stop("selectieschema_ongeldig", str(selection_report.get("metadata_schema_version")))

    expected_counts = selection_report.get("geselecteerd_per_objecttype") or {}
    actual_selection_counts = Counter(objecttype for objecttype, _ in selection)
    if dict(sorted(actual_selection_counts.items())) != dict(sorted(expected_counts.items())):
        return stop(
            "selectietellingen_wijken_af",
            f"selectiebestand={dict(sorted(actual_selection_counts.items()))} rapport={dict(sorted(expected_counts.items()))}",
        )

    if not args.bronbestand.is_file():
        return stop("bron_ontbreekt", str(args.bronbestand))
    measured_hash = sha256_file(args.bronbestand)
    if args.verwachte_hash and measured_hash != args.verwachte_hash:
        return stop("bron_hash_drift", f"{measured_hash} != {args.verwachte_hash}")

    selection_sha256 = sha256_file(args.selectiebestand)
    seen: Counter[tuple[str, str]] = Counter()
    standrecords_read = 0
    records_written = 0
    records_without_primary = 0
    parse_errors: list[str] = []
    written_types: Counter[str] = Counter()

    with args.output.open("w", encoding="utf-8") as target:
        try:
            with zipfile.ZipFile(args.bronbestand) as archive:
                for source_path, stream in iter_zip_xml(archive):
                    try:
                        for stand in iter_stand_elements(stream):
                            standrecords_read += 1
                            key = primary_key(stand)
                            if key is None:
                                records_without_primary += 1
                                continue
                            if key not in selection:
                                continue
                            seen[key] += 1
                            xml = ET.tostring(stand, encoding="unicode")
                            target.write(json.dumps({"bronpad": source_path, "xml": xml}, ensure_ascii=False) + "\n")
                            records_written += 1
                            written_types[key[0]] += 1
                            if records_written % 50_000 == 0:
                                print(f"{records_written:,} directioneel geselecteerde standrecords geschreven", flush=True)
                    except (ET.ParseError, OSError) as exc:
                        parse_errors.append(f"{source_path}: {exc}")
        except (zipfile.BadZipFile, OSError) as exc:
            parse_errors.append(str(exc))

    missing = sorted([list(key) for key in selection if seen[key] == 0])
    duplicate_keys = sorted([
        {"objecttype": key[0], "identificatie": key[1], "standrecords": count}
        for key, count in seen.items() if count > 1
    ], key=lambda item: (item["objecttype"], item["identificatie"]))

    proof = {
        "status": "amsterdam_directional_full_subset_validated",
        "contractversie": "bag-amsterdam-directional-full-subset/3",
        "metadata_schema_version": 3,
        "bron_sha256": measured_hash,
        "selectiebestand_sha256": selection_sha256,
        "geselecteerde_unieke_sleutels": len(selection),
        "geselecteerd_per_objecttype": dict(sorted(actual_selection_counts.items())),
        "standrecords_gelezen": standrecords_read,
        "records_geschreven": records_written,
        "records_zonder_primaire_identificatie": records_without_primary,
        "geschreven_per_objecttype": dict(sorted(written_types.items())),
        "ontbrekende_geselecteerde_sleutels": len(missing),
        "ontbrekende_geselecteerde_sleutel_voorbeelden": missing[:20],
        "sleutels_met_meerdere_standrecords": len(duplicate_keys),
        "sleutels_met_meerdere_standrecords_voorbeelden": duplicate_keys[:20],
        "parse_fouten": parse_errors,
        "output_sha256": sha256_file(args.output),
        "output_bytes": args.output.stat().st_size,
        "database_write_uitgevoerd": False,
        "supabase_benaderd": False,
        "productie_benaderd": False,
    }

    if parse_errors:
        proof.update(status="directional_full_subset_blocked", code="parsefout")
    elif missing:
        proof.update(status="directional_full_subset_blocked", code="geselecteerde_sleutels_ontbreken")
    elif records_written < len(selection):
        proof.update(status="directional_full_subset_blocked", code="recordtelling_te_laag")

    proof_path.write_text(json.dumps(proof, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if proof["status"] != "amsterdam_directional_full_subset_validated":
        print(json.dumps(proof, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(proof, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
