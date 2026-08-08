import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BagOfficieelAdapterRecord } from './officieleXmlRecordAdapter';
import { exporteerAmsterdamSpoolNaarCsvStreamend } from './amsterdamStreamingCsvExport';

const tijdelijkeMappen: string[] = [];
afterEach(async () => {
  await Promise.all(tijdelijkeMappen.splice(0).map(pad => rm(pad, { recursive: true, force: true })));
});

function record(overrides: Partial<BagOfficieelAdapterRecord> = {}): BagOfficieelAdapterRecord {
  return {
    objecttype: 'Pand',
    identificatie: '0363100000000001',
    status: 'Pand in gebruik',
    voorkomen: {
      voorkomenidentificatie: 1,
      beginGeldigheid: '2020-01-01',
      eindGeldigheid: null,
      tijdstipRegistratie: '2020-01-01 10:00:00',
      eindRegistratie: null,
      tijdstipRegistratieLV: null,
      tijdstipEindRegistratieLV: null,
      tijdstipInactief: null,
      tijdstipInactiefLV: null,
    },
    geometrie: { vorm: 'polygoon', crs: 'EPSG:28992', dimensie: 2, coordinaten: [0, 0, 1, 0, 1, 1, 0, 0] },
    relaties: { nummeraanduidingIds: ['na-1'] },
    velden: { oorspronkelijkBouwjaar: 1990 },
    ...overrides,
  };
}

describe('exporteerAmsterdamSpoolNaarCsvStreamend', () => {
  it('schrijft objecten, voorkomens, unieke relaties, geometrieën en hashes streamend', async () => {
    const map = await mkdtemp(join(tmpdir(), 'bag-amsterdam-csv-'));
    tijdelijkeMappen.push(map);
    const invoer = join(map, 'gesorteerd.ndjson');
    const uitvoer = join(map, 'export');
    const records = [
      record(),
      record({
        voorkomen: { ...record().voorkomen, voorkomenidentificatie: 2, beginGeldigheid: '2021-01-01' },
        relaties: { nummeraanduidingIds: ['na-1', 'na-2'] },
      }),
      record({ identificatie: '0363100000000002', geometrie: { vorm: 'geen', crs: null, dimensie: null, coordinaten: [] }, relaties: {} }),
    ];
    await writeFile(invoer, `${records.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf-8');

    const resultaat = await exporteerAmsterdamSpoolNaarCsvStreamend(invoer, uitvoer, {
      datasetVersie: 'v-test',
      scopeCode: '0363',
    });

    expect(resultaat).toMatchObject({ gelezen: 3, objecten: 2, voorkomens: 3, relaties: 2, geometrieen: 2, geometrieAfwijkingen: 0 });
    expect(Object.values(resultaat.bestanden).every(item => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect((await readFile(join(uitvoer, 'objecten.csv'), 'utf-8')).trim().split('\n')).toHaveLength(2);
    expect((await readFile(join(uitvoer, 'relaties.csv'), 'utf-8')).trim().split('\n')).toHaveLength(2);
    expect(await readFile(join(uitvoer, 'geometrieen.csv'), 'utf-8')).toContain('POLYGON Z');
    const manifest = JSON.parse(await readFile(join(uitvoer, 'manifest.json'), 'utf-8'));
    expect(manifest).toMatchObject({ status: 'streaming_csv_export_voltooid', database_write_uitgevoerd: false, supabase_benaderd: false, productie_benaderd: false });
  });

  it('rapporteert ongeldige geometrie zonder de export te stoppen', async () => {
    const map = await mkdtemp(join(tmpdir(), 'bag-amsterdam-csv-'));
    tijdelijkeMappen.push(map);
    const invoer = join(map, 'gesorteerd.ndjson');
    const uitvoer = join(map, 'export');
    await writeFile(invoer, `${JSON.stringify(record({ geometrie: { vorm: 'polygoon', crs: 'EPSG:28992', dimensie: 2, coordinaten: [0, 0, 1] } }))}\n`, 'utf-8');

    const resultaat = await exporteerAmsterdamSpoolNaarCsvStreamend(invoer, uitvoer);
    expect(resultaat.geometrieen).toBe(0);
    expect(resultaat.geometrieAfwijkingen).toBe(1);
    expect(await readFile(join(uitvoer, 'geometrie-koppelafwijkingen.jsonl'), 'utf-8')).toContain('ongeldige_brongeometrie');
  });

  it('blokkeert een niet op objectidentiteit gesorteerd spoolbestand', async () => {
    const map = await mkdtemp(join(tmpdir(), 'bag-amsterdam-csv-'));
    tijdelijkeMappen.push(map);
    const invoer = join(map, 'ongesorteerd.ndjson');
    const uitvoer = join(map, 'export');
    await writeFile(invoer, `${JSON.stringify(record({ identificatie: '2' }))}\n${JSON.stringify(record({ identificatie: '1' }))}\n`, 'utf-8');

    await expect(exporteerAmsterdamSpoolNaarCsvStreamend(invoer, uitvoer)).rejects.toThrow('niet op objectidentiteit gesorteerd');
  });
});
