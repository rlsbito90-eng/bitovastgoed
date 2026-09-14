import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx'),
  'utf8',
);

describe('Radar-bulkselectie herstellen na refresh', () => {
  it('schoont de herstelde selectie pas op nadat beide bronqueries succesvol geladen zijn', () => {
    expect(bron).toContain('isSuccess: selectieGeladen');
    expect(bron).toContain('isSuccess: signalenGeladen');
    expect(bron).toContain('if (!selectieGeladen || !signalenGeladen) return;');
  });
});
