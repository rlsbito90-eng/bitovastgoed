#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/bag/build-amsterdam-chunk-manifest.py"


def laad_module():
    module_name = "chunk_manifest"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(module_name, None)
        raise
    return module


def main() -> int:
    module = laad_module()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        nested = root / "nested.zip"
        with zipfile.ZipFile(nested, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("b.xml", "<root>bbbbbbbb</root>")
            archive.writestr("a.xml", "<root>a</root>")

        source = root / "landelijk.zip"
        with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("direct/c.xml", "<root>cccc</root>")
            archive.write(nested, "nested/objecten.zip")
            archive.writestr("negeren.txt", "geen brononderdeel")

        eerste = module.bouw_manifest(source, 2)
        tweede = module.bouw_manifest(source, 2)
        assert eerste == tweede
        assert eerste["aantal_brononderdelen"] == 3
        assert eerste["chunk_count"] == 2
        assert sum(item["aantal_onderdelen"] for item in eerste["chunks"]) == 3
        assert eerste["database_write_uitgevoerd"] is False
        assert eerste["supabase_benaderd"] is False
        assert eerste["productie_benaderd"] is False
        paden = [item["bronpad"] for item in eerste["onderdelen"]]
        assert paden == sorted(paden)
        assert "nested/objecten.zip!a.xml" in paden
        assert "nested/objecten.zip!b.xml" in paden
        assert "direct/c.xml" in paden

        output = root / "manifest.json"
        subprocess.run(
            ["python3", str(SCRIPT), str(source), str(output), "--chunks", "2"],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        geschreven = json.loads(output.read_text(encoding="utf-8"))
        assert geschreven == eerste

        try:
            module.verdeel([], 9)
        except ValueError:
            pass
        else:
            raise AssertionError("Meer dan acht chunks moet worden geweigerd")

    print("Amsterdam chunkmanifesttest OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
