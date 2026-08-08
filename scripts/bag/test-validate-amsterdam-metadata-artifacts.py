#!/usr/bin/env python3
from __future__ import annotations

import json, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/bag/validate-amsterdam-metadata-artifacts.py"


def report(index: int) -> dict:
    chunk_id = f"chunk-{index:02d}"
    return {
        "status": "metadata_chunk_validated",
        "schema_version": 3,
        "metadata_record_schema": ["objecttype", "identificatie", "woonplaats_naam", "relaties"],
        "gemeentecode": "0363",
        "chunk_id": chunk_id,
        "chunk_count": 8,
        "bronbestand": "lvbag-extract-nl.zip",
        "bron_sha256": "bronhash",
        "manifest_sha256": "manifesthash",
        "metadata_sha256": f"metadatahash-{index}",
        "verwachte_brononderdelen": 1,
        "gelezen_brononderdelen": 1,
        "brononderdelen": [{"bronpad": f"deel-{index}.xml", "fingerprint": f"fp-{index}"}],
        "metadatarecords": index * 10,
        "records_zonder_identificatie": index % 2,
        "amsterdam_seed_records": index,
        "objecttype_tellingen": {"Pand": index},
        "relatietype_tellingen": {"pand": index * 2},
        "woonplaats_tellingen": {"amsterdam": 1 if index == 1 else 0},
        "parse_fouten": 0,
        "database_write_uitgevoerd": False,
        "supabase_benaderd": False,
        "productie_benaderd": False,
    }


def run(reports: list[Path], output: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(SCRIPT), *map(str, reports), "--output", str(output)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        paths = []
        for index in range(1, 9):
            path = root / f"chunk-{index:02d}-rapport.json"
            path.write_text(json.dumps(report(index)), encoding="utf-8")
            paths.append(path)

        output = root / "gezamenlijk.json"
        result = run(paths, output)
        assert result.returncode == 0, result.stdout + result.stderr
        combined = json.loads(output.read_text(encoding="utf-8"))
        assert combined["status"] == "amsterdam_metadata_artifacts_validated"
        assert combined["schema_version"] == 3
        assert combined["metadata_record_schema"] == ["objecttype", "identificatie", "woonplaats_naam", "relaties"]
        assert combined["unieke_brononderdelen"] == 8
        assert combined["metadatarecords"] == 360
        assert combined["records_zonder_identificatie"] == 4
        assert combined["amsterdam_seed_records"] == 36
        assert combined["objecttype_tellingen"] == {"Pand": 36}
        assert combined["relatietype_tellingen"] == {"pand": 72}
        assert combined["woonplaats_tellingen"] == {"amsterdam": 1}

        blocked = report(8)
        blocked["schema_version"] = 2
        paths[-1].write_text(json.dumps(blocked), encoding="utf-8")
        result = run(paths, output)
        assert result.returncode == 1
        combined = json.loads(output.read_text(encoding="utf-8"))
        assert combined["status"] == "amsterdam_metadata_artifacts_blocked"
        assert any("schema_version" in item for item in combined["afwijkingen"])

    print("Amsterdam gezamenlijke artifactvalidatietest schema v3 OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
