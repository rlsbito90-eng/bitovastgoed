#!/usr/bin/env python3
"""Valideer acht Amsterdam-metadata-artifacts en bereken streaming de relationele closure.

Verwachte bestanden in de chunkmap:
- chunk-01-rapport.json t/m chunk-08-rapport.json
- chunk-01-metadata.ndjson.gz t/m chunk-08-metadata.ndjson.gz

Metadataregels hebben het bewezen formaat: [primaire_identificatie|null, [identificaties...]].
Het script voert geen database- of netwerkactie uit.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import sys
from pathlib import Path

CHUNKS = tuple(f"chunk-{i:02d}" for i in range(1, 9))
STATUS = "metadata_chunk_validated"
VALIDATIE_STATUS = "amsterdam_metadata_artifacts_validated"
GEMEENTECODE = "0363"
MAX_PASSES = 25


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def iter_metadata(paths: list[Path]):
    for path in paths:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                value = json.loads(line)
                if not isinstance(value, list) or len(value) != 2:
                    raise ValueError(f"{path.name}:{line_number}: metadataregel heeft geen [primary, ids]-vorm")
                primary, identifiers = value
                if primary is not None and not isinstance(primary, str):
                    raise ValueError(f"{path.name}:{line_number}: primary is geen string/null")
                if not isinstance(identifiers, list) or any(not isinstance(item, str) for item in identifiers):
                    raise ValueError(f"{path.name}:{line_number}: identifiers is geen stringlijst")
                yield primary, identifiers


def checksum_ids(ids: set[str]) -> str:
    return hashlib.sha256("\n".join(sorted(ids)).encode()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("chunkmap", type=Path)
    parser.add_argument("validatierapport", type=Path)
    parser.add_argument("outputmap", type=Path)
    parser.add_argument("--maximum-passes", type=int, default=MAX_PASSES)
    args = parser.parse_args()

    output = args.outputmap.resolve()
    output.mkdir(parents=True, exist_ok=True)
    bewijs_path = output / "metadata-bewijs.json"
    closure_path = output / "closure-bewijs.json"

    fouten: list[str] = []
    try:
        validatie = json.loads(args.validatierapport.read_text(encoding="utf-8"))
    except Exception as exc:
        validatie = {}
        fouten.append(f"validatierapport_onleesbaar:{exc}")

    if validatie.get("status") != VALIDATIE_STATUS:
        fouten.append(f"ongeldige_validatiestatus:{validatie.get('status')}")
    if validatie.get("chunk_ids") != list(CHUNKS):
        fouten.append("chunk_ids_wijken_af")
    if validatie.get("parse_fouten") != 0 or validatie.get("afwijkingen"):
        fouten.append("gezamenlijke_validatie_bevat_afwijkingen")

    reports: list[dict] = []
    metadata_paths: list[Path] = []
    bron_sha: str | None = None
    manifest_sha: str | None = None
    brononderdelen: set[str] = set()
    metadatarecords_expected = 0

    for chunk_id in CHUNKS:
        report_path = args.chunkmap / f"{chunk_id}-rapport.json"
        metadata_path = args.chunkmap / f"{chunk_id}-metadata.ndjson.gz"
        if not report_path.is_file():
            fouten.append(f"ontbrekend_rapport:{chunk_id}")
            continue
        if not metadata_path.is_file():
            fouten.append(f"ontbrekende_metadata:{chunk_id}")
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        reports.append(report)
        metadata_paths.append(metadata_path)
        if report.get("chunk_id") != chunk_id or report.get("chunk_count") != 8:
            fouten.append(f"ongeldige_chunkidentiteit:{chunk_id}")
        if report.get("status") != STATUS or report.get("parse_fouten") != 0:
            fouten.append(f"ongeldige_chunkstatus:{chunk_id}")
        bron_sha = bron_sha or report.get("bron_sha256")
        manifest_sha = manifest_sha or report.get("manifest_sha256")
        if report.get("bron_sha256") != bron_sha:
            fouten.append(f"bron_hash_drift:{chunk_id}")
        if report.get("manifest_sha256") != manifest_sha:
            fouten.append(f"manifest_hash_drift:{chunk_id}")
        measured = sha256_file(metadata_path)
        if measured != report.get("metadata_sha256"):
            fouten.append(f"metadata_hash_drift:{chunk_id}:{measured}")
        metadatarecords_expected += int(report.get("metadatarecords", 0))
        for part in report.get("brononderdelen", []):
            path = part.get("bronpad") if isinstance(part, dict) else part
            if not path:
                fouten.append(f"ongeldig_brononderdeel:{chunk_id}")
            elif path in brononderdelen:
                fouten.append(f"overlappend_brononderdeel:{path}")
            else:
                brononderdelen.add(path)

    if validatie.get("metadatarecords") != metadatarecords_expected:
        fouten.append("metadatarecord_telling_wijkt_af")
    if validatie.get("unieke_brononderdelen") != len(brononderdelen):
        fouten.append("brononderdeel_telling_wijkt_af")

    bewijs = {
        "status": "stop" if fouten else "metadata_index_validated",
        "contractversie": "bag-amsterdam-metadata-index/2-streaming",
        "chunk_ids": list(CHUNKS),
        "bron_sha256": bron_sha,
        "manifest_sha256": manifest_sha,
        "metadatarecords": metadatarecords_expected,
        "brononderdelen": len(brononderdelen),
        "fouten": fouten,
        "database_write_uitgevoerd": False,
    }
    bewijs_path.write_text(json.dumps(bewijs, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if fouten:
        print(json.dumps(bewijs, indent=2), file=sys.stderr)
        return 1

    # Gzip-bestanden mogen conform RFC 1952 als members worden geconcateneerd.
    index_path = output / "metadata-index.ndjson.gz"
    with index_path.open("wb") as target:
        for path in metadata_paths:
            with path.open("rb") as source:
                shutil.copyfileobj(source, target, length=8 * 1024 * 1024)
    bewijs["index_sha256"] = sha256_file(index_path)
    bewijs["index_bytes"] = index_path.stat().st_size
    bewijs_path.write_text(json.dumps(bewijs, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    selected: set[str] = set()
    scanned = 0
    for primary, identifiers in iter_metadata(metadata_paths):
        scanned += 1
        if primary and primary.startswith(GEMEENTECODE):
            selected.add(primary)
            selected.update(identifiers)
    if not selected:
        closure_path.write_text(json.dumps({"status": "stop", "code": "geen_seeds"}, indent=2) + "\n")
        return 1

    growth: list[int] = []
    converged = False
    for pass_number in range(1, args.maximum_passes + 1):
        added: set[str] = set()
        for primary, identifiers in iter_metadata(metadata_paths):
            hit = bool((primary and primary in selected) or any(item in selected for item in identifiers))
            if not hit:
                continue
            if primary:
                added.add(primary)
            added.update(identifiers)
        before = len(selected)
        selected.update(added)
        delta = len(selected) - before
        growth.append(delta)
        print(f"closurepass {pass_number}: groei={delta:,} totaal={len(selected):,}", flush=True)
        if delta == 0:
            converged = True
            break

    selected_records = 0
    for primary, identifiers in iter_metadata(metadata_paths):
        if (primary and primary in selected) or any(item in selected for item in identifiers):
            selected_records += 1

    selected_sorted = sorted(selected)
    selection_path = output / "closure-selectie.txt"
    selection_path.write_text("\n".join(selected_sorted) + "\n", encoding="utf-8")
    selection_checksum = checksum_ids(selected)
    (output / "closure-selectie.sha256").write_text(selection_checksum + "\n", encoding="utf-8")

    closure = {
        "status": "closure_validated" if converged else "stop",
        "contractversie": "bag-amsterdam-closure/2-streaming",
        "gemeentecode": GEMEENTECODE,
        "metadatarecords": scanned,
        "seeds_en_gerelateerde_ids": len(selected_sorted),
        "geselecteerdeRecords": selected_records,
        "passes": len(growth),
        "maximumPasses": args.maximum_passes,
        "groeiPerPass": growth,
        "selectieChecksum": selection_checksum,
        "selectiebestand": selection_path.name,
        "fouten": [] if converged else ["geen_convergentie"],
        "database_write_uitgevoerd": False,
    }
    closure_path.write_text(json.dumps(closure, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if converged else 1


if __name__ == "__main__":
    raise SystemExit(main())
