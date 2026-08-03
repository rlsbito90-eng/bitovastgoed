import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exporteerAssenNaarPostgisCsv } from '../../../scripts/bag/exporteer-assen-naar-postgis-csv';

const tijdelijkeMappen: string[] = [];

afterEach(() => {
  for (const map of tijdelijkeMappen.splice(0)) rmSync(map, { recursive: true, force: true });
});

interface XmlVoorkomen {
  status: string;
  voorkomenidentificatie?: number;
  beginGeldigheid: string;
  eindGeldigheid?: string;
  tijdstipRegistratie: string;
  eindRegistratie?: string;
  tijdstipInactief?: string;
  coordinaten: string;
}

function vboXml(voorkomen: XmlVoorkomen): string {
  const element = (naam: string, waarde: string | number | undefined) => (
    waarde == null ? '' : `<typ:${naam}>${waarde}</typ:${naam}>`
  );
  return `
    <sl:bagObject xmlns:sl="urn:bag" xmlns:obj="urn:bag-object" xmlns:typ="urn:bag-type" xmlns:gml="http://www.opengis.net/gml/3.2">
      <sl:object>
        <obj:Verblijfsobject>
          <obj:identificatie>0106010000033804</obj:identificatie>
          <obj:status>${voorkomen.status}</obj:status>
          <obj:geometrie><gml:Point><gml:pos srsDimension="3">${voorkomen.coordinaten}</gml:pos></gml:Point></obj:geometrie>
        </obj:Verblijfsobject>
      </sl:object>
      <sl:voorkomen><typ:Voorkomen>
        ${element('voorkomenidentificatie', voorkomen.voorkomenidentificatie)}
        ${element('beginGeldigheid', voorkomen.beginGeldigheid)}
        ${element('eindGeldigheid', voorkomen.eindGeldigheid)}
        ${element('tijdstipRegistratie', voorkomen.tijdstipRegistratie)}
        ${element('eindRegistratie', voorkomen.eindRegistratie)}
        ${element('tijdstipInactief', voorkomen.tijdstipInactief)}
      </typ:Voorkomen></sl:voorkomen>
    </sl:bagObject>`;
}

function schrijfInput(records: string[]): { input: string; output: string } {
  const map = mkdtempSync(join(tmpdir(), 'bag-postgis-export-'));
  tijdelijkeMappen.push(map);
  const input = join(map, 'records.ndjson');
  const output = join(map, 'export');
  writeFileSync(
    input,
    `${records.map((xml, index) => JSON.stringify({ bronpad: `record-${index + 1}.xml`, xml })).join('\n')}\n`,
    'utf-8',
  );
  return { input, output };
}

const gevormd: XmlVoorkomen = {
  status: 'Verblijfsobject gevormd',
  voorkomenidentificatie: 1,
  beginGeldigheid: '2008-11-13',
  tijdstipRegistratie: '2009-11-06 13:37:13',
  coordinaten: '100 200 0',
};

const inGebruik: XmlVoorkomen = {
  status: 'Verblijfsobject in gebruik',
  voorkomenidentificatie: 1,
  beginGeldigheid: '2008-11-13',
  eindGeldigheid: '2011-01-06',
  tijdstipRegistratie: '2011-07-12 11:03:58',
  eindRegistratie: '2011-07-12 11:03:58',
  coordinaten: '101 201 0',
};

describe('PostGIS CSV-export met semantische geometriekoppeling', () => {
  it('lost de bewezen dubbele Assen-groep op met volgnummer 1 per technisch voorkomen', async () => {
    const { input, output } = schrijfInput([vboXml(inGebruik), vboXml(gevormd)]);
    const resultaat = await exporteerAssenNaarPostgisCsv(input, output);
    const geometrieen = readFileSync(join(output, 'geometrieen.csv'), 'utf-8').trim().split('\n');

    expect(resultaat).toMatchObject({
      voorkomens: 2,
      geometrieen: 2,
      overgeslagenGeometrieen: 0,
      ontbrekendeVoorkomenkoppelingen: 0,
      ambigueVoorkomenkoppelingen: 0,
      dubbeleVoorkomenidentificaties: 1,
    });
    expect(geometrieen).toEqual([
      '"Verblijfsobject","0106010000033804","1|2008-11-13||2009-11-06T13:37:13.000||","1","1","POINT Z (100 200 0)"',
      '"Verblijfsobject","0106010000033804","1|2008-11-13|2011-01-06|2011-07-12T11:03:58.000|2011-07-12T11:03:58.000|","1","1","POINT Z (101 201 0)"',
    ]);
    expect(readFileSync(join(output, 'geometrie-koppelafwijkingen.jsonl'), 'utf-8')).toBe('');
  });

  it('bewaart ontbrekende en ambigue koppelingen controleerbaar zonder eerste kandidaat', async () => {
    const zonderVoorkomenId: XmlVoorkomen = {
      ...gevormd,
      voorkomenidentificatie: undefined,
      coordinaten: '102 202 0',
    };
    const { input, output } = schrijfInput([
      vboXml(zonderVoorkomenId),
      vboXml(gevormd),
      vboXml(gevormd),
    ]);
    const resultaat = await exporteerAssenNaarPostgisCsv(input, output);
    const afwijkingen = readFileSync(join(output, 'geometrie-koppelafwijkingen.jsonl'), 'utf-8')
      .trim()
      .split('\n')
      .map(regel => JSON.parse(regel) as Record<string, unknown>);

    expect(resultaat).toMatchObject({
      geometrieen: 0,
      overgeslagenGeometrieen: 3,
      ontbrekendeVoorkomenkoppelingen: 1,
      ambigueVoorkomenkoppelingen: 2,
    });
    expect(afwijkingen.map(item => item.code)).toEqual([
      'ontbrekende_voorkomenkoppeling',
      'ambigue_voorkomenkoppeling',
      'ambigue_voorkomenkoppeling',
    ]);
    expect(afwijkingen[0]).toMatchObject({
      bronWkt: 'POINT Z (102 202 0)',
      bronGeometrie: { crs: 'EPSG:28992', dimensie: 3, coordinaten: [102, 202, 0] },
      bronmetadata: { voorkomenidentificatie: null },
    });
    expect(afwijkingen[1]).toMatchObject({
      kandidaten: [
        { voorkomenSleutel: '1|2008-11-13||2009-11-06T13:37:13.000||' },
        { voorkomenSleutel: '1|2008-11-13||2009-11-06T13:37:13.000||' },
      ],
    });
  });

  it('levert dezelfde export bij omgekeerde invoervolgorde', async () => {
    const a = schrijfInput([vboXml(gevormd), vboXml(inGebruik)]);
    const b = schrijfInput([vboXml(inGebruik), vboXml(gevormd)]);

    await exporteerAssenNaarPostgisCsv(a.input, a.output);
    await exporteerAssenNaarPostgisCsv(b.input, b.output);

    for (const bestand of [
      'voorkomens.csv',
      'geometrieen.csv',
      'geometrie-koppelafwijkingen.jsonl',
    ]) {
      expect(readFileSync(join(a.output, bestand), 'utf-8')).toBe(
        readFileSync(join(b.output, bestand), 'utf-8'),
      );
    }
  });
});
