#!/usr/bin/env python3
"""Bereken de directionele Amsterdam/Weesp BAG-scope uit metadata-schema v3.

Deze stap is volledig lokaal/read-only ten opzichte van externe systemen. De acht gzip-metadatafiles
worden samengebracht in een tijdelijke disk-backed SQLite-index. Daarna volgt uitsluitend:
Woonplaats -> OpenbareRuimte -> Nummeraanduiding -> adresseerbaar object -> Pand.
Panden met historische/huidige Amsterdam-prefix 0457/0363 worden daarnaast expliciet geseed.
"""
from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
import tempfile
import time
from collections import Counter
from pathlib import Path

TARGET_WOONPLAATSEN = {"amsterdam", "weesp"}
PAND_SEED_PREFIXES = {"0363", "0457"}
OBJECTTYPEN = {
    "Pand", "Verblijfsobject", "Nummeraanduiding", "OpenbareRuimte",
    "Woonplaats", "Standplaats", "Ligplaats",
}
RELATIETYPEN = {"pand", "nummeraanduiding", "openbare_ruimte", "woonplaats"}
BATCH_SIZE = 20_000
HEARTBEAT = 1_000_000


def log(message: str) -> None:
    print(f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] {message}", flush=True)


def open_index(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA temp_store=FILE")
    conn.execute("PRAGMA cache_size=-131072")
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


def flush(
    conn: sqlite3.Connection,
    object_batch: list[tuple[str, str, str | None]],
    relation_batch: list[tuple[str, str, str, str]],
) -> None:
    if object_batch:
        conn.executemany(
            """
            INSERT INTO objecten(objecttype, identificatie, woonplaats_naam)
            VALUES (?, ?, ?)
            ON CONFLICT(objecttype, identificatie) DO UPDATE SET
              woonplaats_naam = COALESCE(excluded.woonplaats_naam, objecten.woonplaats_naam)
            """,
            object_batch,
        )
        object_batch.clear()
    if relation_batch:
        conn.executemany(
            "INSERT INTO relaties(bron_objecttype, bron_identificatie, relatietype, doel_identificatie) VALUES (?, ?, ?, ?)",
            relation_batch,
        )
        relation_batch.clear()
    conn.commit()


def build_index(
    metadata_paths: list[Path], index_path: Path
) -> tuple[int, int, int, Counter[str]]:
    conn = open_index(index_path)
    object_batch: list[tuple[str, str, str | None]] = []
    relation_batch: list[tuple[str, str, str, str]] = []
    records = invalid = skipped_unknown = 0
    objecttype_counts: Counter[str] = Counter()
    try:
        for path in metadata_paths:
            log(f"Lees metadata: {path.name}")
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                for line_number, line in enumerate(handle, start=1):
                    if not line.strip():
                        continue
                    records += 1
                    try:
                        row = json.loads(line)
                        if not isinstance(row, list) or len(row) != 4:
                            raise ValueError("metadatarecord heeft niet vier velden")
                        objecttype, identificatie, woonplaats_naam, relaties = row

                        # Het landelijke Extract bevat ook <stand>-records buiten de zeven
                        # relevante BAG-objecttypen. De chunkextractor markeert die bewust als
                        # Onbekend en kan daar geen primaire identificatie voor leveren. Ze zijn
                        # geen corrupte metadata en mogen de Amsterdam-selectie daarom niet blokkeren.
                        if objecttype == "Onbekend" and (
                            identificatie is None
                            or (isinstance(identificatie, str) and not identificatie.strip())
                        ):
                            skipped_unknown += 1
                            continue

                        if objecttype not in OBJECTTYPEN:
                            raise ValueError(f"onverwacht objecttype: {objecttype!r}")
                        if not isinstance(identificatie, str) or not identificatie.strip():
                            raise ValueError("identificatie ontbreekt voor relevant BAG-objecttype")
                        if not isinstance(relaties, list):
                            raise ValueError("relaties is geen lijst")

                        woonplaats = woonplaats_naam if isinstance(woonplaats_naam, str) and woonplaats_naam else None
                        object_batch.append((objecttype, identificatie.strip(), woonplaats))
                        objecttype_counts[objecttype] += 1
                        for relatie in relaties:
                            if not isinstance(relatie, list) or len(relatie) != 2:
                                raise ValueError("relatie heeft niet twee velden")
                            relatietype, doel = relatie
                            if relatietype not in RELATIETYPEN or not isinstance(doel, str) or not doel.strip():
                                raise ValueError("relatietype/doel ongeldig")
                            relation_batch.append((objecttype, identificatie.strip(), relatietype, doel.strip()))
                    except (json.JSONDecodeError, ValueError, TypeError) as exc:
                        invalid += 1
                        if invalid <= 20:
                            log(f"Ongeldig metadatarecord {path.name}:{line_number}: {exc}")

                    if len(object_batch) >= BATCH_SIZE or len(relation_batch) >= BATCH_SIZE * 3:
                        flush(conn, object_batch, relation_batch)
                    if records % HEARTBEAT == 0:
                        log(
                            f"Index-invoer: {records:,} metadatarecords; "
                            f"overgeslagen_onbekend={skipped_unknown:,}; ongeldig={invalid:,}"
                        )

        flush(conn, object_batch, relation_batch)
        log("Maak relationele indexen na bulk-load")
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
    return records, invalid, skipped_unknown, objecttype_counts


def count(conn: sqlite3.Connection, table: str) -> int:
    return int(conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0])


def select_scope(index_path: Path) -> tuple[dict[str, set[str]], list[dict[str, int]]]:
    conn = sqlite3.connect(index_path)
    conn.execute("PRAGMA temp_store=FILE")
    conn.execute("PRAGMA cache_size=-131072")
    steps: list[dict[str, int]] = []
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
        steps.append({"stap": 1, "woonplaatsen": count(conn, "sel_woonplaats")})

        conn.execute(
            """
            INSERT OR IGNORE INTO sel_openbare
            SELECT DISTINCT r.bron_identificatie
            FROM relaties r JOIN sel_woonplaats s ON s.identificatie = r.doel_identificatie
            WHERE r.bron_objecttype='OpenbareRuimte' AND r.relatietype='woonplaats'
            """
        )
        steps.append({"stap": 2, "openbare_ruimten": count(conn, "sel_openbare")})

        conn.execute(
            """
            INSERT OR IGNORE INTO sel_nummer
            SELECT DISTINCT r.bron_identificatie
            FROM relaties r JOIN sel_openbare s ON s.identificatie = r.doel_identificatie
            WHERE r.bron_objecttype='Nummeraanduiding' AND r.relatietype='openbare_ruimte'
            """
        )
        steps.append({"stap": 3, "nummeraanduidingen": count(conn, "sel_nummer")})

        for objecttype, table in (
            ("Verblijfsobject", "sel_vbo"),
            ("Standplaats", "sel_standplaats"),
            ("Ligplaats", "sel_ligplaats"),
        ):
            conn.execute(
                f"""
                INSERT OR IGNORE INTO {table}
                SELECT DISTINCT r.bron_identificatie
                FROM relaties r JOIN sel_nummer s ON s.identificatie = r.doel_identificatie
                WHERE r.bron_objecttype=? AND r.relatietype='nummeraanduiding'
                """,
                (objecttype,),
            )
        steps.append({
            "stap": 4,
            "verblijfsobjecten": count(conn, "sel_vbo"),
            "standplaatsen": count(conn, "sel_standplaats"),
            "ligplaatsen": count(conn, "sel_ligplaats"),
        })

        conn.execute(
            """
            INSERT OR IGNORE INTO sel_pand
            SELECT DISTINCT r.doel_identificatie
            FROM relaties r JOIN sel_vbo v ON v.identificatie = r.bron_identificatie
            WHERE r.bron_objecttype='Verblijfsobject' AND r.relatietype='pand'
            """
        )
        prefix_clause = " OR ".join("identificatie LIKE ?" for _ in PAND_SEED_PREFIXES)
        conn.execute(
            f"INSERT OR IGNORE INTO sel_pand SELECT identificatie FROM objecten WHERE objecttype='Pand' AND ({prefix_clause})",
            tuple(f"{prefix}%" for prefix in sorted(PAND_SEED_PREFIXES)),
        )
        steps.append({"stap": 5, "panden": count(conn, "sel_pand")})

        selected: dict[str, set[str]] = {}
        for objecttype, table in (
            ("Woonplaats", "sel_woonplaats"),
            ("OpenbareRuimte", "sel_openbare"),
            ("Nummeraanduiding", "sel_nummer"),
            ("Verblijfsobject", "sel_vbo"),
            ("Standplaats", "sel_standplaats"),
            ("Ligplaats", "sel_ligplaats"),
            ("Pand", "sel_pand"),
        ):
            selected[objecttype] = {row[0] for row in conn.execute(f"SELECT identificatie FROM {table}")}
        return selected, steps
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("metadata", nargs="+", type=Path)
    parser.add_argument("--selection-output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    if len(args.metadata) != 8:
        parser.error("exact acht metadatafiles zijn vereist")
    missing = [str(path) for path in args.metadata if not path.is_file()]
    if missing:
        parser.error(f"metadatafiles ontbreken: {missing}")

    started = time.monotonic()
    timings: dict[str, float] = {}
    with tempfile.TemporaryDirectory(prefix="bag-amsterdam-metadata-v3-") as tmp:
        index_path = Path(tmp) / "metadata.sqlite3"
        phase = time.monotonic()
        records, invalid, skipped_unknown, source_type_counts = build_index(args.metadata, index_path)
        timings["index_bouwen_seconden"] = round(time.monotonic() - phase, 1)

        phase = time.monotonic()
        selected, steps = select_scope(index_path)
        timings["scope_selecteren_seconden"] = round(time.monotonic() - phase, 1)

    args.selection_output.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(args.selection_output, "wt", encoding="utf-8", compresslevel=6) as handle:
        for objecttype in sorted(selected):
            for identificatie in sorted(selected[objecttype]):
                handle.write(json.dumps([objecttype, identificatie], separators=(",", ":")) + "\n")

    pand_prefixes = Counter(identifier[:4] for identifier in selected["Pand"] if identifier)
    unexpected = {
        prefix: amount for prefix, amount in sorted(pand_prefixes.items())
        if prefix not in PAND_SEED_PREFIXES
    }
    selected_counts = {key: len(value) for key, value in sorted(selected.items())}
    report = {
        "status": "amsterdam_directionele_metadata_selectie_validated" if invalid == 0 and selected["Woonplaats"] else "amsterdam_directionele_metadata_selectie_blocked",
        "metadata_schema_version": 3,
        "strategie": "directionele_adresketen_uit_acht_relationele_metadata_chunks",
        "target_woonplaatsen": sorted(TARGET_WOONPLAATSEN),
        "pand_seed_prefixes": sorted(PAND_SEED_PREFIXES),
        "metadatarecords_gelezen": records,
        "overgeslagen_onbekende_records": skipped_unknown,
        "ongeldige_metadatarecords": invalid,
        "bron_objecttype_tellingen": dict(sorted(source_type_counts.items())),
        "selectiestappen": steps,
        "geselecteerd_per_objecttype": selected_counts,
        "pand_prefix_tellingen": dict(sorted(pand_prefixes.items())),
        "onverwachte_pand_prefixes": unexpected,
        "onverwachte_pand_prefix_voorbeelden": {
            prefix: sorted(identifier for identifier in selected["Pand"] if identifier.startswith(prefix))[:20]
            for prefix in unexpected
        },
        "doorlooptijd_seconden": round(time.monotonic() - started, 1),
        "fase_doorlooptijden": timings,
        "database_write_uitgevoerd": False,
        "supabase_benaderd": False,
        "productie_benaderd": False,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0 if report["status"].endswith("validated") else 1


if __name__ == "__main__":
    raise SystemExit(main())
