import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(
  path.resolve('src/components/acquisitie/AcquisitieBrievenStatusKaart.tsx'),
  'utf8',
);

describe('FIX 2.0C — CRM-status volgt eigenaar-specifieke koppeling', () => {
  it('neemt eigenaar.crmRelatieId mee naast legacy read-modelstatus', () => {
    expect(bron).toContain('eigenaarCrmGekoppeld');
    expect(bron).toContain('eigenaarOpties.some((eigenaar) => Boolean(eigenaar.crmRelatieId))');
    expect(bron).toContain('model.relatieGekoppeld || eigenaarCrmGekoppeld');
    expect(bron).toContain('jaNee(crmRelatieGekoppeld)');
  });

  it('behoudt legacy compatibiliteit zonder nieuwe relatie of automatische koppeling', () => {
    expect(bron).toContain('model.relatieGekoppeld || eigenaarCrmGekoppeld');
    expect(bron).not.toContain("from('relaties').insert");
    expect(bron).not.toContain('updateEigenaarRelatie');
  });
});
