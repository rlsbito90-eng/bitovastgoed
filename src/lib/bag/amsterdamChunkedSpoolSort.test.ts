import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sorteerAmsterdamSpoolInChunks } from './amsterdamChunkedSpoolSort';

interface TestRecord {
  sleutel: string;
  volgnummer: number;
}

async function leesNdjson<T>(pad: string): Promise<T[]> {
  const inhoud = await readFile(pad, 'utf-8');
  return inhoud.trim().split('\n').filter(Boolean).map(regel => JSON.parse(regel) as T);
}

describe('Amsterdam chunked spool sort', () => {
  it('sorteert over meerdere begrensde chunks en behoudt alle records', async () => {
    const map = await mkdtemp(join(tmpdir(), 'bag-amsterdam-sort-'));
    const invoerPad = join(map, 'invoer.ndjson');
    const uitvoerPad = join(map, 'uitvoer.ndjson');
    const werkmap = join(map, 'chunks');
    const records: TestRecord[] = [
      { sleutel: 'c', volgnummer: 3 },
      { sleutel: 'a', volgnummer: 1 },
      { sleutel: 'b', volgnummer: 2 },
      { sleutel: 'a', volgnummer: 0 },
      { sleutel: 'd', volgnummer: 4 },
    ];
    await writeFile(invoerPad, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf-8');

    const resultaat = await sorteerAmsterdamSpoolInChunks<TestRecord>({
      invoerPad,
      uitvoerPad,
      werkmap,
      sleutel: record => record.sleutel,
      maxRecordsPerChunk: 2,
    });

    expect(resultaat).toMatchObject({ gelezen: 5, geschreven: 5, chunks: 3 });
    expect(await leesNdjson<TestRecord>(uitvoerPad)).toEqual([
      { sleutel: 'a', volgnummer: 0 },
      { sleutel: 'a', volgnummer: 1 },
      { sleutel: 'b', volgnummer: 2 },
      { sleutel: 'c', volgnummer: 3 },
      { sleutel: 'd', volgnummer: 4 },
    ]);
  });

  it('levert bij gelijke sleutels deterministische JSON-volgorde', async () => {
    const map = await mkdtemp(join(tmpdir(), 'bag-amsterdam-sort-'));
    const invoerPad = join(map, 'invoer.ndjson');
    const uitvoerPad = join(map, 'uitvoer.ndjson');
    const records: TestRecord[] = [
      { sleutel: 'zelfde', volgnummer: 9 },
      { sleutel: 'zelfde', volgnummer: 2 },
      { sleutel: 'zelfde', volgnummer: 5 },
    ];
    await writeFile(invoerPad, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf-8');

    await sorteerAmsterdamSpoolInChunks<TestRecord>({
      invoerPad,
      uitvoerPad,
      werkmap: join(map, 'chunks'),
      sleutel: record => record.sleutel,
      maxRecordsPerChunk: 1,
    });

    expect((await leesNdjson<TestRecord>(uitvoerPad)).map(record => record.volgnummer)).toEqual([2, 5, 9]);
  });

  it('weigert een ongeldige chunkgrootte voordat verwerking start', async () => {
    await expect(sorteerAmsterdamSpoolInChunks<TestRecord>({
      invoerPad: 'niet-gebruikt.ndjson',
      uitvoerPad: 'niet-gebruikt-uit.ndjson',
      werkmap: 'niet-gebruikt-werk',
      sleutel: record => record.sleutel,
      maxRecordsPerChunk: 0,
    })).rejects.toThrow('positief geheel getal');
  });
});
