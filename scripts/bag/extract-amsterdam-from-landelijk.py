#!/usr/bin/env python3
"""Extraheer de actuele Amsterdamse BAG-adresketen uit het landelijke BAG Extract.

De selectie is richtinggevoelig en voorkomt transitieve scope-uitwaaiing:
1. scan het landelijke Extract één keer naar een disk-backed SQLite-relatie-index;
2. selecteer woonplaatsen Amsterdam en Weesp;
3. volg via geïndexeerde joins uitsluitend de adresketen naar buiten:
   Woonplaats -> OpenbareRuimte -> Nummeraanduiding -> adresseerbaar object -> Pand;
4. voeg daarnaast Panden met huidige/legacy Amsterdamse bronprefix 0363/0457 toe,
   zodat ook Panden zonder adresseerbaar VBO niet stil verdwijnen;
5. scan de landelijke bron een tweede keer en schrijf uitsluitend expliciet geselecteerde records.

De SQLite-index vervangt meerdere volledige rescans van een enorm metadata-NDJSON-bestand.
Hierdoor blijft het geheugen begrensd, terwijl de relationele selectie via indexen verloopt.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
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
SQL_BATCH_SIZE = 20_000
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
    relaties: list[tuple[str, str]] = []
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
            relaties.append((relatie, tekst))
        if objecttype == "Woonplaats" and naam.lower() == "naam" and tekst:
            woonplaats_naam = tekst

    return {
        "identificatie": primaire_identificatie,
        "objecttype": objecttype,
        "relaties": relaties,
        "woonplaats_naam": woonplaats_naam,
    }


def record_identity(xml: str) -> tuple[str, str | None]:
    """Lees voor bronscan 2 alleen objecttype en primaire identificatie."""
    root = ET.fromstring(xml)
    objecttype = "Onbekend"
    identificatie: str | None = None
    for element in root.iter():
        naam = local_name(element.tag)
        if objecttype == "Onbekend" and naam in OBJECTTYPEN:
            objecttype = naam
        if identificatie is None and naam.lower() == "identificatie":
            tekst = (element.text or "").strip()
            if tekst:
                identificatie = tekst
        if objecttype != "Onbekend" and identificatie is not None:
            break
    return objecttype, identificatie


def scan_records(source: Path) -> Iterator[tuple[str, str, dict[str, object]]]:
    with zipfile.ZipFile(source) as archive:
        for bronpad, stream in iter_zip_xml(archive):
            log(f"Bronscan leest {bronpad}")
            for xml in iter_stand_xml(stream):
                yield bronpad, xml, record_metadata(xml)


def scan_raw_records(source: Path) -> Iterator[tuple[str, str]]:
    with zipfile.ZipFile(source) as archive:
        for bronpad, stream in iter_zip_xml(archive):
            log(f"Subsetscan leest {bronpad}")
            for xml in iter_stand_xml(stream):
                yield bronpad, xml


def open_index(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA temp_store=FILE")
    conn.execute("PRAGMA cache_size=-131072")  # circa 128 MiB cache
    conn.execute("PRAGMA locking_mode=EXCLUSIVE")
    conn.executescript(
        """
        CREATE TABLE objecten (
          objecttype TEXT NOT NULL,
          identificatie TEXT NOT NULL,
          woonplaats_naam TEXT,
          PRIMARY KEY (objecttype, identificatie)
        ) WITHOUT ROWID;

        CREATE TABLE relaties (
          bron_objecttype TEXT NOT NULL,
          bron_identificatie TEXT NOT NULL,
          relatietype TEXT NOT NULL,
          doel_identificatie TEXT NOT NULL
        );
        """
    )
    return conn


def flush_index_batches(
    conn: sqlite3.Connection,
    object_batch: list[tuple[str, str, str | None]],
    relatie_batch: list[tuple[str, str, str, str]],
) -> None:
    if object_batch:
        conn.executemany(
            "INSERT OR IGNORE INTO objecten(objecttype, identificatie, woonplaats_naam) VALUES (?, ?, ?)",
            object_batch,
        )
        object_batch.clear()
    if relatie_batch:
        conn.executemany(
            "INSERT INTO relaties(bron_objecttype, bron_identificatie, relatietype, doel_identificatie) VALUES (?, ?, ?, ?)",
            relatie_batch,
        )
        relatie_batch.clear()
    conn.commit()


def bouw_relationele_index(source: Path, index_path: Path) -> int:
    bekeken = 0
    conn = open_index(index_path)
    object_batch: list[tuple[str, str, str | None]] = []
    relatie_batch: list[tuple[str, str, str, str]] = []
    try:
        for _, _, metadata in scan_records(source):
            bekeken += 1
            objecttype = str(metadata.get("objecttype") or "Onbekend")
            identificatie_raw = metadata.get("identificatie")
            identificatie = identificatie_raw if isinstance(identificatie_raw, str) and identificatie_raw.strip() else None
            if identificatie and objecttype in OBJECTTYPEN:
                woonplaats_naam_raw = metadata.get("woonplaats_naam")
                woonplaats_naam = norm(woonplaats_naam_raw if isinstance(woonplaats_naam_raw, str) else None) or None
                object_batch.append((objecttype, identificatie, woonplaats_naam))
                raw_relaties = metadata.get("relaties")
                if isinstance(raw_relaties, list):
                    for item in raw_relaties:
                        if not isinstance(item, (list, tuple)) or len(item) != 2:
                            continue
                        relatietype, doel = str(item[0]).strip(), str(item[1]).strip()
                        if relatietype and doel:
                            relatie_batch.append((objecttype, identificatie, relatietype, doel))

            if len(object_batch) >= SQL_BATCH_SIZE or len(relatie_batch) >= SQL_BATCH_SIZE * 3:
                flush_index_batches(conn, object_batch, relatie_batch)
            if bekeken % HEARTBEAT_INTERVAL == 0:
                log(f"Index: {bekeken:,} records")

        flush_index_batches(conn, object_batch, relatie_batch)
        log("Maak relationele SQLite-indexen")
        conn.executescript(
            """
            CREATE INDEX relaties_doel_idx
              ON relaties(relatietype, doel_identificatie, bron_objecttype, bron_identificatie);
            CREATE INDEX relaties_bron_idx
              ON relaties(bron_objecttype, bron_identificatie, relatietype, doel_identificatie);
            ANALYZE;
            """
        )
        conn.commit()
    finally:
        conn.close()
    log(f"Relationele index gereed: {bekeken:,} records")
    return bekeken


def count_table(conn: sqlite3.Connection, table: str) -> int:
    return int(conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0])


def bereken_directionele_selectie(index_path: Path) -> tuple[dict[str, set[str]], list[dict[str, int]]]:
    stappen: list[dict[str, int]] = []
    conn = sqlite3.connect(index_path)
    conn.execute("PRAGMA temp_store=FILE")
    conn.execute("PRAGMA cache_size=-131072")
    try:
        conn.executescript(
            """
            CREATE TEMP TABLE sel_woonplaats(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            CREATE TEMP TABLE sel_openbare(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            CREATE TEMP TABLE sel_nummer(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            CREATE TEMP TABLE sel_vbo(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            CREATE TEMP TABLE sel_standplaats(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            CREATE TEMP TABLE sel_ligplaats(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            CREATE TEMP TABLE sel_pand(identificatie TEXT PRIMARY KEY) WITHOUT ROWID;
            """
        )

        placeholders = ",".join("?" for _ in TARGET_WOONPLAATSEN)
        conn.execute(
            f"INSERT OR IGNORE INTO sel_woonplaats SELECT identificatie FROM objecten WHERE objecttype='Woonplaats' AND woonplaats_naam IN ({placeholders})",
            tuple(sorted(TARGET_WOONPLAATSEN)),
        )
        stappen.append({"stap": 1, "woonplaatsen": count_table(conn, "sel_woonplaats")})

        conn.execute(
            """
            INSERT OR IGNORE INTO sel_openbare
            SELECT DISTINCT r.bron_identificatie
            FROM relaties r
            JOIN sel_woonplaats s ON s.identificatie = r.doel_identificatie
            WHERE r.bron_objecttype='OpenbareRuimte' AND r.relatietype='woonplaats'
            """
        )
        stappen.append({"stap": 2, "openbare_ruimten": count_table(conn, "sel_openbare")})

        conn.execute(
            """
            INSERT OR IGNORE INTO sel_nummer
            SELECT DISTINCT r.bron_identificatie
            FROM relaties r
            JOIN sel_openbare s ON s.identificatie = r.doel_identificatie
            WHERE r.bron_objecttype='Nummeraanduiding' AND r.relatietype='openbare_ruimte'
            """
        )
        stappen.append({"stap": 3, "nummeraanduidingen": count_table(conn, "sel_nummer")})

        for objecttype, table in (
            ("Verblijfsobject", "sel_vbo"),
            ("Standplaats", "sel_standplaats"),
            ("Ligplaats", "sel_ligplaats"),
        ):
            conn.execute(
                f"""
                INSERT OR IGNORE INTO {table}
                SELECT DISTINCT r.bron_identificatie
                FROM relaties r
                JOIN sel_nummer s ON s.identificatie = r.doel_identificatie
                WHERE r.bron_objecttype=? AND r.relatietype='nummeraanduiding'
                """,
                (objecttype,),
            )
        stappen.append({
            "stap": 4,
            "verblijfsobjecten": count_table(conn, "sel_vbo"),
            "standplaatsen": count_table(conn, "sel_standplaats"),
            "ligplaatsen": count_table(conn, "sel_ligplaats"),
        })

        conn.execute(
            """
            INSERT OR IGNORE INTO sel_pand
            SELECT DISTINCT r.doel_identificatie
            FROM relaties r
            JOIN sel_vbo v ON v.identificatie = r.bron_identificatie
            WHERE r.bron_objecttype='Verblijfsobject' AND r.relatietype='pand'
            """
        )
        prefix_clause = " OR ".join("identificatie LIKE ?" for _ in PAND_SEED_PREFIXES)
        conn.execute(
            f"INSERT OR IGNORE INTO sel_pand SELECT identificatie FROM objecten WHERE objecttype='Pand' AND ({prefix_clause})",
            tuple(f"{prefix}%" for prefix in sorted(PAND_SEED_PREFIXES)),
        )
        stappen.append({"stap": 5, "panden": count_table(conn, "sel_pand")})

        geselecteerd: dict[str, set[str]] = defaultdict(set)
        for objecttype, table in (
            ("Woonplaats", "sel_woonplaats"),
            ("OpenbareRuimte", "sel_openbare"),
            ("Nummeraanduiding", "sel_nummer"),
            ("Verblijfsobject", "sel_vbo"),
            ("Standplaats", "sel_standplaats"),
            ("Ligplaats", "sel_ligplaats"),
            ("Pand", "sel_pand"),
        ):
            geselecteerd[objecttype].update(row[0] for row in conn.execute(f"SELECT identificatie FROM {table}"))
        return geselecteerd, stappen
    finally:
        conn.close()


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
        for bronpad, xml in scan_raw_records(source):
            bekeken += 1
            objecttype, identificatie = record_identity(xml)
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
            index_path = Path(tmp) / "relaties.sqlite3"
            log("Start bronscan 1/2: bouw disk-backed relationele SQLite-index")
            bekeken_records = bouw_relationele_index(source, index_path)

            log("Bereken richtinggevoelige Amsterdam/Weesp-adresketen via geïndexeerde joins")
            geselecteerd, stappen = bereken_directionele_selectie(index_path)
            if not geselecteerd["Woonplaats"]:
                raise RuntimeError("Geen woonplaats Amsterdam of Weesp gevonden")
            if not geselecteerd["Pand"]:
                raise RuntimeError("Geen Amsterdamse Panden geselecteerd")

            log("Start bronscan 2/2: schrijf geografisch begrensde subset")
            geschreven, zonder_identificatie, objecttypen, prefix_tellingen, pand_prefix_tellingen = schrijf_subset(
                source, output, geselecteerd
            )
    except (ET.ParseError, zipfile.BadZipFile, OSError, RuntimeError, sqlite3.Error) as exc:
        parse_fouten.append(str(exc))

    afwijkende_pand_prefixen = {
        prefix: aantal
        for prefix, aantal in sorted(pand_prefix_tellingen.items())
        if prefix not in PAND_SEED_PREFIXES
    }
    rapport = {
        "scope_code": SCOPE,
        "strategie": "directionele_adresketen_sqlite_index_twee_bronpasses",
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
