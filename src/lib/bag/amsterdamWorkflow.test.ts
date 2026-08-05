import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { voerAmsterdamMetadataEnClosureUit } from '../../../scripts/bag/amsterdam-metadata-en-closure';
import { bereidAmsterdamImportVoor } from '../../../scripts/bag/bereid-amsterdam-import-voor';

const chunkMap = process.env.BAG_AMSTERDAM_CHUNKS;
const rapportPad = process.env.BAG_AMSTERDAM_RAPPORT;
const metadataOutput = process.env.BAG_AMSTERDAM_METADATA_OUTPUT;
const subsetPad = process.env.BAG_AMSTERDAM_SUBSET;
const importOutput = process.env.BAG_AMSTERDAM_IMPORT_OUTPUT;

const metadataDescribe = chunkMap && rapportPad && metadataOutput ? describe : describe.skip;
const importDescribe = subsetPad && metadataOutput && importOutput ? describe : describe.skip;

metadataDescribe('Amsterdam metadata-index en closure', () => {
  it('valideert de acht chunks en convergeert de closure', () => {
    const resultaat = voerAmsterdamMetadataEnClosureUit(chunkMap!, rapportPad!, metadataOutput!);
    expect(resultaat.status).toBe('closure_validated');
    for (const bestand of [
      'metadata-bewijs.json',
      'metadata-index.tsv',
      'closure-bewijs.json',
      'closure-selectie.txt',
      'closure-selectie.sha256',
    ]) {
      expect(existsSync(`${metadataOutput}/${bestand}`)).toBe(true);
    }
    const closure = JSON.parse(readFileSync(`${metadataOutput}/closure-bewijs.json`, 'utf-8')) as {
      rapport: { records: number; groeiPerPass: number[] } | null;
    };
    expect(closure.rapport?.records).toBeGreaterThan(0);
    expect(closure.rapport?.groeiPerPass.at(-1)).toBe(0);
  }, 600_000);
});

importDescribe('Amsterdam importpakket', () => {
  it('produceert een importklaar pakket met GO-besluit en zonder database-import', async () => {
    const resultaat = await bereidAmsterdamImportVoor(
      subsetPad!,
      `${metadataOutput}/closure-bewijs.json`,
      importOutput!,
    );
    expect(resultaat.besluit).toBe('GO');
    const manifest = JSON.parse(readFileSync(resultaat.manifestPad, 'utf-8')) as {
      databaseImportUitgevoerd: boolean;
      scopeCode: string;
      stopCondities: unknown[];
    };
    expect(manifest.databaseImportUitgevoerd).toBe(false);
    expect(manifest.scopeCode).toBe('0363');
    expect(manifest.stopCondities).toHaveLength(0);
  }, 900_000);
});
