import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { normaliseerAmsterdamNdjsonStreamend } from './amsterdamStreamingNormalisatie';

const tijdelijkeMappen: string[] = [];

function maakWerkmap(): string {
  const map = mkdtempSync(join(tmpdir(), 'bag-amsterdam-streaming-'));
  tijdelijkeMappen.push(map);
  return map;
}

afterEach(() => {
  for (const map of tijdelijkeMappen.splice(0)) rmSync(map, { recursive: true, force: true });
});

describe('normaliseerAmsterdamNdjsonStreamend', () => {
  it('schrijft records direct in invoervolgorde naar een spoolbestand', async () => {
    const map = maakWerkmap();
    const invoer = join(map, 'invoer.ndjson');
    const spool = join(map, 'spool', 'records.ndjson');
    const fouten = join(map, 'spool', 'fouten.ndjson');
    writeFileSync(invoer, [
      JSON.stringify({ bronpad: 'a.xml', xml: '<a />' }),
      '',
      JSON.stringify({ bronpad: 'b.xml', xml: '<b />' }),
    ].join('\n'), 'utf-8');

    const resultaat = await normaliseerAmsterdamNdjsonStreamend(
      invoer,
      spool,
      fouten,
      bronregel => ({
        record: { bronpad: bronregel.bronpad, lengte: bronregel.xml.length },
        fouten: [],
      }),
    );

    expect(resultaat).toMatchObject({ gelezen: 2, genormaliseerd: 2, fouten: 0 });
    expect(readFileSync(spool, 'utf-8').trim().split('\n').map(JSON.parse)).toEqual([
      { bronpad: 'a.xml', lengte: 5 },
      { bronpad: 'b.xml', lengte: 5 },
    ]);
    expect(readFileSync(fouten, 'utf-8')).toBe('');
  });

  it('isoleert ongeldige NDJSON en parserfouten zonder geldige records te verliezen', async () => {
    const map = maakWerkmap();
    const invoer = join(map, 'invoer.ndjson');
    const spool = join(map, 'records.ndjson');
    const fouten = join(map, 'fouten.ndjson');
    writeFileSync(invoer, [
      JSON.stringify({ bronpad: 'goed.xml', xml: '<goed />' }),
      '{ongeldig',
      JSON.stringify({ bronpad: 'afgekeurd.xml', xml: '<afgekeurd />' }),
    ].join('\n'), 'utf-8');

    const resultaat = await normaliseerAmsterdamNdjsonStreamend(
      invoer,
      spool,
      fouten,
      bronregel => bronregel.bronpad === 'afgekeurd.xml'
        ? { record: null, fouten: [{ code: 'synthetische_fout', reden: 'afgekeurd voor test' }] }
        : { record: { bronpad: bronregel.bronpad }, fouten: [] },
    );

    expect(resultaat).toMatchObject({ gelezen: 3, genormaliseerd: 1, fouten: 2 });
    expect(readFileSync(spool, 'utf-8').trim().split('\n').map(JSON.parse)).toEqual([
      { bronpad: 'goed.xml' },
    ]);
    expect(readFileSync(fouten, 'utf-8').trim().split('\n').map(JSON.parse)).toEqual([
      expect.objectContaining({ regel: 2, code: 'ongeldige_ndjson', bronpad: null }),
      expect.objectContaining({ regel: 3, code: 'synthetische_fout', bronpad: 'afgekeurd.xml' }),
    ]);
  });
});
