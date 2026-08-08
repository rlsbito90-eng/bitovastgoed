#!/usr/bin/env python3
from __future__ import annotations

import gzip, hashlib, json, subprocess, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/bag/extract-amsterdam-metadata-chunk.py"


def stand(objecttype: str, primary: str, body: str = "") -> str:
    return f"<root><stand><{objecttype}><identificatie>{primary}</identificatie>{body}</{objecttype}></stand></root>"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        nested = root / "nested.zip"
        with zipfile.ZipFile(nested, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr(
                "a.xml",
                stand(
                    "OpenbareRuimte",
                    "0363300000000001",
                    "<WoonplaatsRef>1000</WoonplaatsRef><naam>Damrak</naam>",
                ),
            )
            z.writestr("b.xml", stand("Pand", "0106000000000001"))
        source = root / "landelijk.zip"
        with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.write(nested, "nested/objecten.zip")
            z.writestr("direct/c.xml", stand("Woonplaats", "1000", "<naam>Amsterdam</naam>"))

        source_hash = sha256(source)
        onderdeel_a = {
            "bronpad": "nested/objecten.zip!a.xml",
            "compressed_bytes": 1,
            "uncompressed_bytes": 1,
            "crc32": "00000000",
            "fingerprint": "test-fingerprint-a",
        }
        onderdeel_c = {
            "bronpad": "direct/c.xml",
            "compressed_bytes": 1,
            "uncompressed_bytes": 1,
            "crc32": "00000000",
            "fingerprint": "test-fingerprint-c",
        }
        manifest = {
            "schema_version": 1,
            "bronbestand": source.name,
            "bron_sha256": source_hash,
            "chunk_count": 8,
            "onderdelen": [onderdeel_a, onderdeel_c],
            "chunks": [
                {"chunk_id": "chunk-01", "onderdelen": [onderdeel_a["bronpad"], onderdeel_c["bronpad"]]},
                {"chunk_id": "chunk-02", "onderdelen": ["nested/objecten.zip!b.xml"]},
            ],
        }
        manifest_path = root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        output = root / "chunk-01-metadata.ndjson.gz"
        report = root / "chunk-01-rapport.json"
        subprocess.run(["python3", str(SCRIPT), str(source), str(manifest_path), "chunk-01", str(output), str(report)], check=True, cwd=ROOT)

        with gzip.open(output, "rt", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh]
        assert rows == [
            ["Woonplaats", "1000", "amsterdam", []],
            ["OpenbareRuimte", "0363300000000001", None, [["woonplaats", "1000"]]],
        ]
        result = json.loads(report.read_text(encoding="utf-8"))
        assert result["status"] == "metadata_chunk_validated"
        assert result["schema_version"] == 3
        assert result["metadata_record_schema"] == ["objecttype", "identificatie", "woonplaats_naam", "relaties"]
        assert result["gemeentecode"] == "0363"
        assert result["bron_sha256"] == source_hash
        assert result["manifest_sha256"] == sha256(manifest_path)
        assert result["metadata_sha256"] == sha256(output)
        assert result["brononderdelen"] == [onderdeel_c, onderdeel_a]
        assert result["gelezen_brononderdelen"] == 2
        assert result["metadatarecords"] == 2
        assert result["records_zonder_identificatie"] == 0
        assert result["amsterdam_seed_records"] == 1
        assert result["objecttype_tellingen"] == {"OpenbareRuimte": 1, "Woonplaats": 1}
        assert result["relatietype_tellingen"] == {"woonplaats": 1}
        assert result["woonplaats_tellingen"] == {"amsterdam": 1}
        assert result["database_write_uitgevoerd"] is False
        assert result["supabase_benaderd"] is False
        assert result["productie_benaderd"] is False
    print("Amsterdam metadata-chunktest schema v3 OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
