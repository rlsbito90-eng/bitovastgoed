#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts/bag/extract-amsterdam-from-landelijk.py'


def stand(identificatie: str, verwijzing: str | None = None, objecttype: str = 'Pand') -> str:
    relatie = f'<gerelateerd>{verwijzing}</gerelateerd>' if verwijzing else ''
    return f'<root><stand><{objecttype}><identificatie>{identificatie}</identificatie>{relatie}</{objecttype}></stand></root>'


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        nested = tmp_path / 'nested.zip'
        with zipfile.ZipFile(nested, 'w') as archive:
            # De keten staat bewust vóór de Amsterdamseed in archive-volgorde. De metadata-index
            # moet de closure daarom onafhankelijk van de XML-volgorde kunnen berekenen.
            archive.writestr('01-related-last.xml', stand('8888000000000001', objecttype='Woonplaats'))
            archive.writestr('02-related-middle.xml', stand('9999000000000001', '8888000000000001', 'OpenbareRuimte'))
            archive.writestr('03-seed.xml', stand('0363000000000001', '9999000000000001'))
            archive.writestr('04-other.xml', stand('0106000000000001'))

        source = tmp_path / 'landelijk.zip'
        with zipfile.ZipFile(source, 'w') as archive:
            archive.write(nested, 'objecten/nested.zip')

        output = tmp_path / 'amsterdam.ndjson'
        report = tmp_path / 'report.json'
        completed = subprocess.run(
            ['python3', str(SCRIPT), str(source), str(output), str(report)],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        records = [json.loads(line) for line in output.read_text(encoding='utf-8').splitlines()]
        payload = '\n'.join(record['xml'] for record in records)
        assert '0363000000000001' in payload
        assert '9999000000000001' in payload
        assert '8888000000000001' in payload
        assert '0106000000000001' not in payload

        result = json.loads(report.read_text(encoding='utf-8'))
        assert result['strategie'] == 'metadata_index_relatieclosure_twee_bronpasses'
        assert result['bron_scans'] == 2
        assert result['geindexeerde_records'] == 4
        assert result['geschreven_records'] == 3
        assert result['prefix_tellingen']['0363'] == 1
        assert result['prefix_tellingen']['9999'] == 1
        assert result['prefix_tellingen']['8888'] == 1
        assert len(result['passes']) >= 2
        assert result['passes'][-1]['nieuwe_identificaties'] == 0
        assert 'Start bronscan 1/2' in completed.stdout
        assert 'Start bronscan 2/2' in completed.stdout
    print('Amsterdam landelijke extractietest OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
