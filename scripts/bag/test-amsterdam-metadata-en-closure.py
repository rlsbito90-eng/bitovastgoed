#!/usr/bin/env python3
from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("amsterdam-metadata-en-closure.py")
BRON = "f" * 64
MANIFEST = "a" * 64


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def maak_fixture(root: Path, drift: bool = False) -> tuple[Path, Path, Path]:
    chunks = root / "chunks"
    output = root / "output"
    chunks.mkdir()
    total_records = 0
    total_parts = 0
    for number in range(1, 9):
        chunk_id = f"chunk-{number:02d}"
        metadata = chunks / f"{chunk_id}-metadata.ndjson.gz"
        records = []
        if number == 1:
            records = [
                ["0363100000000001", ["0363010000000001"]],
                ["0363010000000001", ["0457010000000001"]],
            ]
        elif number == 2:
            records = [["0457010000000001", []]]
        else:
            records = [[f"01061000000000{number:02d}", []]]
        with gzip.open(metadata, "wt", encoding="utf-8", compresslevel=6, mtime=0) as handle:
            for record in records:
                handle.write(json.dumps(record, separators=(",", ":")) + "\n")
        report = {
            "status": "metadata_chunk_validated",
            "chunk_id": chunk_id,
            "chunk_count": 8,
            "bron_sha256": BRON,
            "manifest_sha256": MANIFEST,
            "metadata_sha256": ("0" * 64 if drift and number == 1 else sha(metadata)),
            "metadatarecords": len(records),
            "parse_fouten": 0,
            "brononderdelen": [{"bronpad": f"deel-{number}.xml"}],
        }
        (chunks / f"{chunk_id}-rapport.json").write_text(json.dumps(report), encoding="utf-8")
        total_records += len(records)
        total_parts += 1
    validation = root / "validation.json"
    validation.write_text(json.dumps({
        "status": "amsterdam_metadata_artifacts_validated",
        "chunk_ids": [f"chunk-{i:02d}" for i in range(1, 9)],
        "metadatarecords": total_records,
        "unieke_brononderdelen": total_parts,
        "parse_fouten": 0,
        "afwijkingen": [],
    }), encoding="utf-8")
    return chunks, validation, output


def run(drift: bool = False):
    with tempfile.TemporaryDirectory(prefix="amsterdam-closure-test-") as tmp:
        chunks, validation, output = maak_fixture(Path(tmp), drift)
        result = subprocess.run(
            ["python3", str(SCRIPT), str(chunks), str(validation), str(output), "--maximum-passes", "10"],
            text=True,
            capture_output=True,
        )
        proof = json.loads((output / "metadata-bewijs.json").read_text())
        closure = json.loads((output / "closure-bewijs.json").read_text()) if (output / "closure-bewijs.json").exists() else None
        return result, proof, closure


def main() -> int:
    ok, proof, closure = run(False)
    assert ok.returncode == 0, ok.stderr
    assert proof["status"] == "metadata_index_validated"
    assert closure["status"] == "closure_validated"
    assert closure["geselecteerdeRecords"] == 3
    assert closure["groeiPerPass"][-1] == 0

    bad, proof_bad, _ = run(True)
    assert bad.returncode == 1
    assert proof_bad["status"] == "stop"
    assert any("metadata_hash_drift:chunk-01" in item for item in proof_bad["fouten"])
    print("amsterdam_metadata_en_closure_tests_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
