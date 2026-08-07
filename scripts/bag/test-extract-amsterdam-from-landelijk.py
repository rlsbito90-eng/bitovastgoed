#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts/bag/extract-amsterdam-from-landelijk.py'
VALIDATOR = ROOT / 'scripts/bag/validate-amsterdam-source.py'


def stand(objecttype: str, identificatie: str, body: str = '') -> str:
    return f'<root><stand><{objecttype}><identificatie>{identificatie}</identificatie>{body}</{objecttype}></stand></root>'


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        nested = tmp_path / 'nested.zip'
        with zipfile.ZipFile(nested, 'w') as archive:
            # De records staan bewust niet in relationele volgorde. De lokale metadata-index
            # moet de richtinggevoelige selectie onafhankelijk van archive-volgorde berekenen.
            archive.writestr(
                '01-amsterdam-woonplaats.xml',
                stand('Woonplaats', '1000', '<naam>Amsterdam</naam>'),
            )
            archive.writestr(
                '02-amsterdam-straat.xml',
                stand('OpenbareRuimte', '0363300000000001', '<WoonplaatsRef>1000</WoonplaatsRef><naam>Teststraat</naam>'),
            )
            archive.writestr(
                '03-amsterdam-nummer.xml',
                stand('Nummeraanduiding', '0363200000000001', '<OpenbareRuimteRef>0363300000000001</OpenbareRuimteRef><huisnummer>1</huisnummer><postcode>1011AA</postcode>'),
            )
            archive.writestr(
                '04-amsterdam-vbo.xml',
                stand(
                    'Verblijfsobject',
                    '0363010000000001',
                    '<PandRef>0363100000000001</PandRef>'
                    '<PandRef>0362100000009999</PandRef>'
                    '<NummeraanduidingRef>0363200000000001</NummeraanduidingRef>',
                ),
            )
            archive.writestr('05-amsterdam-pand.xml', stand('Pand', '0363100000000001'))

            # Deze Amstelveense PandRef hangt aan hetzelfde Amsterdamse VBO. De oude generieke
            # closure trok daardoor vervolgens de hele Amstelveense relatiecluster binnen.
            # De nieuwe richtinggevoelige selectie mag alleen deze direct gerefereerde Pand zien;
            # een tweede Amstelveens VBO/nummer/straat mag niet door transitieve uitbreiding volgen.
            archive.writestr('06-grens-pand.xml', stand('Pand', '0362100000009999'))
            archive.writestr(
                '07-amstelveen-woonplaats.xml',
                stand('Woonplaats', '2000', '<naam>Amstelveen</naam>'),
            )
            archive.writestr(
                '08-amstelveen-straat.xml',
                stand('OpenbareRuimte', '0362300000000002', '<WoonplaatsRef>2000</WoonplaatsRef><naam>Andereweg</naam>'),
            )
            archive.writestr(
                '09-amstelveen-nummer.xml',
                stand('Nummeraanduiding', '0362200000000002', '<OpenbareRuimteRef>0362300000000002</OpenbareRuimteRef><huisnummer>2</huisnummer><postcode>1181AA</postcode>'),
            )
            archive.writestr(
                '10-amstelveen-vbo.xml',
                stand(
                    'Verblijfsobject',
                    '0362010000000002',
                    '<PandRef>0362100000009999</PandRef>'
                    '<NummeraanduidingRef>0362200000000002</NummeraanduidingRef>',
                ),
            )
            archive.writestr('11-other-pand.xml', stand('Pand', '0106100000000001'))

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

        assert '<naam>Amsterdam</naam>' in payload
        assert '0363300000000001' in payload
        assert '0363200000000001' in payload
        assert '0363010000000001' in payload
        assert '0363100000000001' in payload

        # Het direct aan een Amsterdam-VBO gekoppelde grenspand wordt expliciet gerapporteerd,
        # maar de rest van het Amstelveense cluster mag niet meekomen.
        assert '0362100000009999' in payload
        assert '0362010000000002' not in payload
        assert '0362200000000002' not in payload
        assert '0362300000000002' not in payload
        assert '<naam>Amstelveen</naam>' not in payload
        assert '0106100000000001' not in payload

        result = json.loads(report.read_text(encoding='utf-8'))
        assert result['strategie'] == 'directionele_adresketen_woonplaats_scope_twee_bronpasses'
        assert result['bron_scans'] == 2
        assert result['geindexeerde_records'] == 11
        assert result['target_woonplaatsen'] == ['amsterdam', 'weesp']
        assert result['pand_seed_prefixes'] == ['0363', '0457']
        assert result['objecttype_tellingen']['Woonplaats'] == 1
        assert result['objecttype_tellingen']['OpenbareRuimte'] == 1
        assert result['objecttype_tellingen']['Nummeraanduiding'] == 1
        assert result['objecttype_tellingen']['Verblijfsobject'] == 1
        assert result['objecttype_tellingen']['Pand'] == 2
        assert result['afwijkende_pand_prefixen'] == {'0362': 1}
        assert 'Start bronscan 1/2' in completed.stdout
        assert 'Start bronscan 2/2' in completed.stdout

        # Fail-closed keten: de extractor mag een direct grensgeval rapporteren, maar de
        # validator moet zo'n subset weigeren voordat die als Amsterdam-bron kan worden gebruikt.
        vervuild_validatierapport = tmp_path / 'vervuild-validatie.json'
        vervuild = subprocess.run(
            ['python3', str(VALIDATOR), str(output), str(vervuild_validatierapport)],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        assert vervuild.returncode == 1
        vervuild_resultaat = json.loads(vervuild_validatierapport.read_text(encoding='utf-8'))
        assert vervuild_resultaat['geldig'] is False
        assert vervuild_resultaat['onverwachte_pand_prefixes'] == {'0362': 1}
        assert vervuild_resultaat['onverwachte_woonplaatsen'] == {}

        # Zonder het expliciet gemarkeerde grenspand moet dezelfde Amsterdamketen wél groen zijn.
        schoon_output = tmp_path / 'amsterdam-schoon.ndjson'
        schone_records = [
            record for record in records
            if '0362100000009999' not in record['xml']
        ]
        schoon_output.write_text(
            ''.join(json.dumps(record, ensure_ascii=False) + '\n' for record in schone_records),
            encoding='utf-8',
        )
        schoon_validatierapport = tmp_path / 'schoon-validatie.json'
        subprocess.run(
            ['python3', str(VALIDATOR), str(schoon_output), str(schoon_validatierapport)],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        schoon_resultaat = json.loads(schoon_validatierapport.read_text(encoding='utf-8'))
        assert schoon_resultaat['geldig'] is True
        assert schoon_resultaat['onverwachte_pand_prefixes'] == {}
        assert schoon_resultaat['onverwachte_woonplaatsen'] == {}

    print('Amsterdam directionele scope-extractie + fail-closed validatie OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
