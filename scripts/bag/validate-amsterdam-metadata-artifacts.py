#!/usr/bin/env python3
"""Valideer gezamenlijk acht Amsterdam-metadatachunkrapporten zonder database- of netwerkaanroepen."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

EXPECTED = {f"chunk-{index:02d}" for index in range(1, 9)}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("reports", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    reports = [json.loads(path.read_text(encoding="utf-8")) for path in args.reports]
    errors: list[str] = []
    chunk_ids = [item.get("chunk_id") for item in reports]
    if len(reports) != 8:
        errors.append(f"verwacht 8 rapporten, ontvangen {len(reports)}")
    if set(chunk_ids) != EXPECTED or len(chunk_ids) != len(set(chunk_ids)):
        errors.append(f"chunkset ongeldig: {chunk_ids}")

    common_fields = ["gemeentecode", "chunk_count", "bronbestand", "bron_sha256", "manifest_sha256"]
    for field in common_fields:
        values = {item.get(field) for item in reports}
        if len(values) != 1 or None in values:
            errors.append(f"inconsistent of ontbrekend veld {field}: {sorted(str(v) for v in values)}")

    seen_paths: dict[str, str] = {}
    total_parts = total_records = total_seeds = total_parse_errors = 0
    for item in reports:
        chunk_id = item.get("chunk_id", "onbekend")
        if item.get("status") != "metadata_chunk_validated":
            errors.append(f"{chunk_id}: status niet groen")
        if item.get("gemeentecode") != "0363":
            errors.append(f"{chunk_id}: gemeentecode is niet 0363")
        for safety_field in ["database_write_uitgevoerd", "supabase_benaderd", "productie_benaderd"]:
            if item.get(safety_field) is not False:
                errors.append(f"{chunk_id}: veiligheidsveld {safety_field} is niet false")
        metadata_path = args.reports[reports.index(item)].with_name(f"{chunk_id}-metadata.ndjson.gz")
        if metadata_path.exists() and item.get("metadata_sha256") != sha256_file(metadata_path):
            errors.append(f"{chunk_id}: metadata_sha256 wijkt af")
        onderdelen = item.get("brononderdelen") or []
        if len(onderdelen) != item.get("verwachte_brononderdelen"):
            errors.append(f"{chunk_id}: brononderdelenlijst sluit niet aan")
        for onderdeel in onderdelen:
            path = onderdeel.get("bronpad")
            if not path:
                errors.append(f"{chunk_id}: brononderdeel zonder bronpad")
            elif path in seen_paths:
                errors.append(f"brononderdeel overlap: {path} in {seen_paths[path]} en {chunk_id}")
            else:
                seen_paths[path] = chunk_id
        total_parts += item.get("gelezen_brononderdelen", 0)
        total_records += item.get("metadatarecords", 0)
        total_seeds += item.get("amsterdam_seed_records", 0)
        total_parse_errors += item.get("parse_fouten", 0)

    result = {
        "status": "amsterdam_metadata_artifacts_validated" if not errors else "amsterdam_metadata_artifacts_blocked",
        "chunk_ids": sorted(chunk_ids),
        "unieke_brononderdelen": len(seen_paths),
        "gelezen_brononderdelen": total_parts,
        "metadatarecords": total_records,
        "amsterdam_seed_records": total_seeds,
        "parse_fouten": total_parse_errors,
        "afwijkingen": errors,
        "database_write_uitgevoerd": False,
        "supabase_benaderd": False,
        "productie_benaderd": False,
    }
    text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
