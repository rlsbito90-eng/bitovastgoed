#!/usr/bin/env python3
from __future__ import annotations

import gzip, json, subprocess, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/bag/extract-amsterdam-metadata-chunk.py"


def stand(primary: str, related: str | None = None) -> str:
    rel = f"<gerelateerd>{related}</gerelateerd>" if related else ""
    return f"<root><stand><Pand><identificatie>{primary}</identificatie>{rel}</Pand></stand></root>"


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        nested = root / "nested.zip"
        with zipfile.ZipFile(nested, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr("a.xml", stand("0363000000000001", "9999000000000001"))
            z.writestr("b.xml", stand("0106000000000001"))
        source = root / "landelijk.zip"
        with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.write(nested, "nested/objecten.zip")
            z.writestr("direct/c.xml", stand("8888000000000001"))

        manifest = {
            "chunks": [
                {"chunk_id": "chunk-01", "onderdelen": ["nested/objecten.zip!a.xml"]},
                {"chunk_id": "chunk-02", "onderdelen": ["nested/objecten.zip!b.xml", "direct/c.xml"]},
            ]
        }
        manifest_path = root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        output = root / "metadata.ndjson.gz"
        report = root / "report.json"
        subprocess.run(["python3", str(SCRIPT), str(source), str(manifest_path), "chunk-01", str(output), str(report)], check=True, cwd=ROOT)

        with gzip.open(output, "rt", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh]
        assert rows == [["0363000000000001", ["0363000000000001", "9999000000000001"]]]
        result = json.loads(report.read_text(encoding="utf-8"))
        assert result["status"] == "metadata_chunk_validated"
        assert result["gelezen_brononderdelen"] == 1
        assert result["metadatarecords"] == 1
        assert result["amsterdam_seed_records"] == 1
        assert result["database_write_uitgevoerd"] is False
    print("Amsterdam metadata-chunktest OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
