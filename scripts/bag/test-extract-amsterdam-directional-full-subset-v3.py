#!/usr/bin/env python3
from __future__ import annotations

import gzip
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/bag/extract-amsterdam-directional-full-subset-v3.py"


def stand(objecttype: str, identificatie: str, body: str = "") -> str:
    return f"<root><stand><{objecttype}><identificatie>{identificatie}</identificatie>{body}</{objecttype}></stand></root>"


def write_selection(path: Path, rows: list[list[str]]) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, separators=(",", ":")) + "\n")


def run(source: Path, selection: Path, report: Path, output: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(SCRIPT), str(source), str(selection), str(report), str(output)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )


def main() -> int:
    selected_rows = [
        ["Woonplaats", "1000"],
        ["OpenbareRuimte", "0363300000000001"],
        ["Nummeraanduiding", "0363200000000001"],
        ["Verblijfsobject", "0363010000000001"],
        ["Pand", "0363100000000001"],
        ["Pand", "0362100000009999"],
    ]

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "landelijk.zip"
        with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("01-woonplaats.xml", stand("Woonplaats", "1000", "<naam>Amsterdam</naam>"))
            archive.writestr("02-openbare.xml", stand("OpenbareRuimte", "0363300000000001", "<WoonplaatsRef>1000</WoonplaatsRef>"))
            archive.writestr("03-nummer.xml", stand("Nummeraanduiding", "0363200000000001", "<OpenbareRuimteRef>0363300000000001</OpenbareRuimteRef>"))
            archive.writestr("04-vbo.xml", stand("Verblijfsobject", "0363010000000001", "<NummeraanduidingRef>0363200000000001</NummeraanduidingRef><PandRef>0362100000009999</PandRef>"))
            archive.writestr("05-pand-a.xml", stand("Pand", "0363100000000001"))
            archive.writestr("06-pand-grens.xml", stand("Pand", "0362100000009999"))
            # Dit object verwijst naar een geselecteerd grenspand maar is zélf niet geselecteerd.
            archive.writestr("07-amstelveen-vbo.xml", stand("Verblijfsobject", "0362010000000002", "<PandRef>0362100000009999</PandRef>"))
            archive.writestr("08-amstelveen-woonplaats.xml", stand("Woonplaats", "2000", "<naam>Amstelveen</naam>"))

        selection = root / "amsterdam-directionele-selectie.ndjson.gz"
        write_selection(selection, selected_rows)
        counts: dict[str, int] = {}
        for objecttype, _ in selected_rows:
            counts[objecttype] = counts.get(objecttype, 0) + 1
        selection_report = root / "amsterdam-directionele-selectie-rapport.json"
        selection_report.write_text(
            json.dumps({
                "status": "amsterdam_directionele_metadata_selectie_validated",
                "metadata_schema_version": 3,
                "geselecteerd_per_objecttype": counts,
            }),
            encoding="utf-8",
        )

        output = root / "full-subset.ndjson"
        result = run(source, selection, selection_report, output)
        assert result.returncode == 0, result.stdout + result.stderr

        proof = json.loads(output.with_suffix(".bewijs.json").read_text(encoding="utf-8"))
        assert proof["status"] == "amsterdam_directional_full_subset_validated"
        assert proof["geselecteerde_unieke_sleutels"] == len(selected_rows)
        assert proof["records_geschreven"] == len(selected_rows)
        assert proof["ontbrekende_geselecteerde_sleutels"] == 0
        assert proof["parse_fouten"] == []
        assert proof["database_write_uitgevoerd"] is False
        assert proof["supabase_benaderd"] is False
        assert proof["productie_benaderd"] is False

        written = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines() if line.strip()]
        xml = "\n".join(row["xml"] for row in written)
        assert "0362010000000002" not in xml
        assert ">2000<" not in xml
        assert "0362100000009999" in xml
        assert ">1000<" in xml

        # Fail-closed: een sleutel die niet in de bron voorkomt blokkeert het pakket.
        missing_rows = selected_rows + [["Pand", "0363100000099999"]]
        write_selection(selection, missing_rows)
        counts["Pand"] += 1
        selection_report.write_text(
            json.dumps({
                "status": "amsterdam_directionele_metadata_selectie_validated",
                "metadata_schema_version": 3,
                "geselecteerd_per_objecttype": counts,
            }),
            encoding="utf-8",
        )
        blocked_output = root / "blocked.ndjson"
        blocked = run(source, selection, selection_report, blocked_output)
        assert blocked.returncode == 1
        blocked_proof = json.loads(blocked_output.with_suffix(".bewijs.json").read_text(encoding="utf-8"))
        assert blocked_proof["status"] == "directional_full_subset_blocked"
        assert blocked_proof["code"] == "geselecteerde_sleutels_ontbreken"
        assert blocked_proof["ontbrekende_geselecteerde_sleutels"] == 1

    print("Amsterdam directionele full-subset v3 extractortest OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
