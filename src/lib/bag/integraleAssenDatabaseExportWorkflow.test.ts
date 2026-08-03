import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exporteerAssenNaarPostgisCsv } from '../../../scripts/bag/exporteer-assen-naar-postgis-csv';

const input = process.env.BAG_DB_EXPORT_INPUT;
const output = process.env.BAG_DB_EXPORT_OUTPUT;

const workflowDescribe = input && output ? describe : describe.skip;

workflowDescribe('officiële Assen-export naar PostGIS-laadbestanden', () => {
  it('exporteert de volledige staginglaag zonder adapteruitval', async () => {
    const resultaat = await exporteerAssenNaarPostgisCsv(input, output);

    expect(resultaat.ontvangen).toBe(168_047);
    expect(resultaat.verwerkt).toBe(168_047);
    expect(resultaat.adapterFouten).toBe(0);
    expect(resultaat.objecten).toBe(128_745);
    expect(resultaat.voorkomens).toBe(168_047);
    expect(resultaat.relatiesBron).toBe(212_738);
    expect(resultaat.relatiesUniek).toBe(160_351);
    expect(resultaat.geometrieen).toBe(122_388);
    expect(resultaat.overgeslagenGeometrieen).toBe(0);
    expect(resultaat.ontbrekendeVoorkomenkoppelingen).toBe(0);
    expect(resultaat.ambigueVoorkomenkoppelingen).toBe(0);
    expect(resultaat.dubbeleVoorkomenidentificaties).toBe(1);

    for (const bestand of [
      'objecten.csv',
      'voorkomens.csv',
      'relaties.csv',
      'geometrieen.csv',
      'geometrie-koppelafwijkingen.jsonl',
      'manifest.json',
    ]) {
      expect(existsSync(`${output}/${bestand}`)).toBe(true);
    }
    expect(readFileSync(`${output}/geometrie-koppelafwijkingen.jsonl`, 'utf-8')).toBe('');

    const manifest = JSON.parse(readFileSync(`${output}/manifest.json`, 'utf-8')) as {
      datasetVersie: string;
      scopeCode: string;
    };
    expect(manifest.datasetVersie).toBe('v20200601');
    expect(manifest.scopeCode).toBe('0106');
  }, 120_000);
});
