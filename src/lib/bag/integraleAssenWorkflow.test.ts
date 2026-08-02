import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runIntegraleAssenDryRun } from '../../../scripts/bag/run-integrale-assen-dry-run';

describe('integrale officiële Assen-dry-run', () => {
  it('verwerkt de volledige tijdelijke NDJSON-set en schrijft compacte rapporten', async () => {
    const input = process.env.BAG_DRY_RUN_INPUT;
    const output = process.env.BAG_DRY_RUN_OUTPUT;

    if (!input || !output) {
      console.warn('BAG_DRY_RUN_INPUT/BAG_DRY_RUN_OUTPUT ontbreken; integrale workflowtest overgeslagen.');
      return;
    }

    const resultaat = await runIntegraleAssenDryRun(input, output);

    expect(resultaat.ontvangen).toBeGreaterThan(0);
    expect(resultaat.verwerkt).toBeGreaterThan(0);
    expect(resultaat.verwerkt).toBeLessThanOrEqual(resultaat.ontvangen);
    expect(existsSync(resultaat.resultaatPad)).toBe(true);
    expect(existsSync(resultaat.rapportPad)).toBe(true);
    expect(statSync(resultaat.resultaatPad).size).toBeGreaterThan(0);
    expect(statSync(resultaat.rapportPad).size).toBeGreaterThan(0);
  }, 120_000);
});
