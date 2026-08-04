#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts/bag/extract-amsterdam-from-landelijk.py'


def stand(identificatie: str, verwijzing: str | None = None) -> str:
    relatie = f'<gerelateerd>{verwijzing}</gerelateerd>' if verwijzing else ''
    return f'<root><stand><Pand><identificatie>{identificatie}</identificatie>{relatie}</Pand></stand></root>'


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        nested = tmp_path / 'nested.zip'
        with zipfile.ZipFile(nested, 'w') as archive:
            archive.writestr('seed.xml', stand('0363000000000001', '9999000000000001'))
            archive.writestr('related.xml', stand('9999000000000001'))
            archive.writestr('other.xml', stand('0106000000000001'))

        source = tmp_path / 'landelijk.zip'
        with zipfile.ZipFile(source, 'w') as archive:
            archive.write(nested, 'objecten/nested.zip')

        output = tmp_path / 'amsterdam.ndjson'
        report = tmp_path / 'report.json'
        subprocess.run(
            ['python3', str(SCRIPT), str(source), str(output), str(report)],
            check=True,
            cwd=ROOT,
        )
        records = [json.loads(line) for line in output.read_text(encoding='utf-8').splitlines()]
        payload = '\n'.join(record['xml'] for record in records)
        assert '0363000000000001' in payload
        assert '9999000000000001' in payload
        assert '0106000000000001' not in payload
        result = json.loads(report.read_text(encoding='utf-8'))
        assert result['geschreven_records'] == 2
        assert result['prefix_tellingen']['0363'] == 1
        assert result['prefix_tellingen']['9999'] == 1
    print('Amsterdam landelijke extractietest OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
