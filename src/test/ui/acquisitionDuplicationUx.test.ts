import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/hooks/useVastgoedrekenen.tsx'), 'utf8');

describe('verkrijgingsstructuur dupliceren', () => {
  it('kopieert verkrijgingscomponenten en vertaalt beide zijden van de één-op-veelkoppeling', () => {
    expect(source).toContain('calculation_acquisition_components');
    expect(source).toContain('calculation_acquisition_unit_links');
    expect(source).toContain('acquisitionComponentIdMap');
    expect(source).toContain('sellOffUnitIdMap');
    expect(source).toContain('newAcquisitionId');
    expect(source).toContain('newSellOffUnitId');
  });

  it('blijft scenario’s dupliceren wanneer de optionele migratie nog niet bestaat', () => {
    expect(source).toContain("error.code !== '42P01'");
  });
});
