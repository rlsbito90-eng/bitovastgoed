#!/usr/bin/env python3
from __future__ import annotations

import argparse, gzip, hashlib, json, shutil, tempfile, time, zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

HEARTBEAT = 50000
GEMEENTECODE = "0363"
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag.split(":")[-1]


def norm(value: str | None) -> str:
    return (value or "").strip().casefold()


def iter_stand_elements(stream):
    """Yield complete <stand>-elementen zonder serialiseer/herparse-ronde."""
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


def metadata(root: ET.Element) -> tuple[str, str | None, str | None, list[list[str]]]:
    objecttype = "Onbekend"
    primary: str | None = None
    woonplaats_naam: str | None = None
    relaties: list[list[str]] = []

    for element in root.iter():
        naam = local_name(element.tag)
        tekst = (element.text or "").strip()
        if objecttype == "Onbekend" and naam in OBJECTTYPEN:
            objecttype = naam
        if primary is None and naam.lower() == "identificatie" and tekst:
            primary = tekst
        relatietype = RELATIE_TAGS.get(naam)
        if relatietype and tekst:
            relaties.append([relatietype, tekst])
        if objecttype == "Woonplaats" and naam.lower() == "naam" and tekst:
            woonplaats_naam = norm(tekst)

    return objecttype, primary, woonplaats_naam, relaties


def walk_selected(archive: zipfile.ZipFile, selected: set[str], prefix: str = ""):
    for member in sorted(archive.infolist(), key=lambda x: x.filename):
        if member.is_dir():
            continue
        path = f"{prefix}!{member.filename}" if prefix else member.filename
        lower = member.filename.lower()
        if lower.endswith(".xml"):
            if path in selected:
                with archive.open(member) as stream:
                    yield path, stream
        elif lower.endswith(".zip"):
            nested_prefix = path + "!"
            if not any(item.startswith(nested_prefix) for item in selected):
                continue
            with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
                with archive.open(member) as source:
                    shutil.copyfileobj(source, tmp, length=8 * 1024 * 1024)
                tmp.flush()
                with zipfile.ZipFile(tmp.name) as nested:
                    yield from walk_selected(nested, selected, path)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("source", type=Path)
    p.add_argument("manifest", type=Path)
    p.add_argument("chunk_id")
    p.add_argument("output", type=Path)
    p.add_argument("report", type=Path)
    args = p.parse_args()

    manifest_bytes = args.manifest.read_bytes()
    manifest = json.loads(manifest_bytes)
    chunk = next((c for c in manifest["chunks"] if c["chunk_id"] == args.chunk_id), None)
    if not chunk:
        p.error(f"Onbekende chunk: {args.chunk_id}")
    selected = set(chunk["onderdelen"])
    onderdelen_by_path = {item["bronpad"]: item for item in manifest.get("onderdelen", [])}
    selected_evidence = [onderdelen_by_path[path] for path in sorted(selected) if path in onderdelen_by_path]

    source_sha256 = sha256_file(args.source)
    if manifest.get("bron_sha256") and manifest["bron_sha256"] != source_sha256:
        p.error("Bronbestand wijkt af van bron_sha256 in manifest")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    started = time.monotonic()
    records = seeds = errors = parts = 0
    objecttypen: Counter[str] = Counter()
    relatie_typen: Counter[str] = Counter()
    woonplaatsen: Counter[str] = Counter()
    records_zonder_identificatie = 0

    with gzip.open(args.output, "wt", encoding="utf-8", compresslevel=6) as out:
        with zipfile.ZipFile(args.source) as archive:
            for _, stream in walk_selected(archive, selected):
                parts += 1
                try:
                    for stand in iter_stand_elements(stream):
                        objecttype, primary, woonplaats_naam, relaties = metadata(stand)
                        # Compact schema v3: [objecttype, identificatie, woonplaats_naam, [[relatietype, doel], ...]]
                        out.write(json.dumps([objecttype, primary, woonplaats_naam, relaties], separators=(",", ":"), ensure_ascii=False) + "\n")
                        records += 1
                        objecttypen[objecttype] += 1
                        if primary is None:
                            records_zonder_identificatie += 1
                        elif primary.startswith(GEMEENTECODE):
                            seeds += 1
                        if woonplaats_naam:
                            woonplaatsen[woonplaats_naam] += 1
                        for relatietype, _ in relaties:
                            relatie_typen[relatietype] += 1
                        if records % HEARTBEAT == 0:
                            print(f"{args.chunk_id}: {records:,} metadatarecords", flush=True)
                except (ET.ParseError, OSError, zipfile.BadZipFile) as exc:
                    errors += 1
                    print(f"Parsefout: {exc}", flush=True)

    report = {
        "status": "metadata_chunk_validated" if errors == 0 and parts == len(selected) else "metadata_chunk_blocked",
        "schema_version": 3,
        "metadata_record_schema": ["objecttype", "identificatie", "woonplaats_naam", "relaties"],
        "gemeentecode": GEMEENTECODE,
        "chunk_id": args.chunk_id,
        "chunk_count": manifest.get("chunk_count"),
        "bronbestand": manifest.get("bronbestand", args.source.name),
        "bron_sha256": source_sha256,
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "metadata_sha256": sha256_file(args.output),
        "verwachte_brononderdelen": len(selected),
        "gelezen_brononderdelen": parts,
        "brononderdelen": selected_evidence,
        "metadatarecords": records,
        "records_zonder_identificatie": records_zonder_identificatie,
        "amsterdam_seed_records": seeds,
        "objecttype_tellingen": dict(sorted(objecttypen.items())),
        "relatietype_tellingen": dict(sorted(relatie_typen.items())),
        "woonplaats_tellingen": dict(sorted(woonplaatsen.items())),
        "parse_fouten": errors,
        "doorlooptijd_seconden": round(time.monotonic() - started, 1),
        "database_write_uitgevoerd": False,
        "supabase_benaderd": False,
        "productie_benaderd": False,
    }
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "brononderdelen"}, ensure_ascii=False), flush=True)
    return 0 if report["status"] == "metadata_chunk_validated" else 1


if __name__ == "__main__":
    raise SystemExit(main())
