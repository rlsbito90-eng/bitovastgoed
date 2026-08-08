#!/usr/bin/env python3
from __future__ import annotations

import gzip
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/bag/select-amsterdam-from-metadata-v3.py"


def write_chunk(path: Path, rows: list[list[object]]) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, separators=(",", ":")) + "\n")


def main() -> int:
    rows = [
        ["Onbekend", None, None, []],
        ["Woonplaats", "1000", "amsterdam", []],
        ["OpenbareRuimte", "0363300000000001", None, [["woonplaats", "1000"]]],
        ["Nummeraanduiding", "0363200000000001", None, [["openbare_ruimte", "0363300000000001"]]],
        ["Verblijfsobject", "0363010000000001", None, [["nummeraanduiding", "0363200000000001"], ["pand", "0363100000000001"], ["pand", "0362100000009999"]]],
        ["Pand", "0363100000000001", None, []],
        ["Pand", "0362100000009999", None, []],
        ["Pand", "0457100000000001", None, []],
        ["Woonplaats", "2000", "amstelveen", []],
        ["OpenbareRuimte", "0362300000000002", None, [["woonplaats", "2000"]]],
        ["Nummeraanduiding", "0362200000000002", None, [["openbare_ruimte", "0362300000000002"]]],
        ["Verblijfsobject", "0362010000000002", None, [["nummeraanduiding", "0362200000000002"], ["pand", "0362100000009999"]]],
    ]

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        paths: list[Path] = []
        for index in range(8):
            path = root / f"chunk-{index + 1:02d}-metadata.ndjson.gz"
            chunk_rows = rows[index::8]
            write_chunk(path, chunk_rows)
            paths.append(path)

        selection = root / "selection.ndjson.gz"
        report = root / "report.json"
        result = subprocess.run(
            ["python3", str(SCRIPT), *map(str, paths), "--selection-output", str(selection), "--report", str(report)],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr

        payload = json.loads(report.read_text(encoding="utf-8"))
        assert payload["status"] == "amsterdam_directionele_metadata_selectie_validated"
        assert payload["metadata_schema_version"] == 3
        assert payload["metadatarecords_gelezen"] == len(rows)
        assert payload["overgeslagen_onbekende_records"] == 1
        assert payload["ongeldige_metadatarecords"] == 0
        assert payload["geselecteerd_per_objecttype"]["Woonplaats"] == 1
        assert payload["geselecteerd_per_objecttype"]["OpenbareRuimte"] == 1
        assert payload["geselecteerd_per_objecttype"]["Nummeraanduiding"] == 1
        assert payload["geselecteerd_per_objecttype"]["Verblijfsobject"] == 1
        assert payload["geselecteerd_per_objecttype"]["Pand"] == 3
        assert payload["pand_prefix_tellingen"] == {"0362": 1, "0363": 1, "0457": 1}
        assert payload["onverwachte_pand_prefixes"] == {"0362": 1}
        assert payload["onverwachte_pand_prefix_voorbeelden"] == {"0362": ["0362100000009999"]}
        assert payload["database_write_uitgevoerd"] is False
        assert payload["supabase_benaderd"] is False
        assert payload["productie_benaderd"] is False

        with gzip.open(selection, "rt", encoding="utf-8") as handle:
            selected = {tuple(json.loads(line)) for line in handle if line.strip()}
        assert ("Pand", "0362100000009999") in selected
        assert ("Verblijfsobject", "0362010000000002") not in selected
        assert ("Nummeraanduiding", "0362200000000002") not in selected
        assert ("OpenbareRuimte", "0362300000000002") not in selected
        assert ("Woonplaats", "2000") not in selected

    print("Amsterdam directionele selectie uit metadata v3 OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
