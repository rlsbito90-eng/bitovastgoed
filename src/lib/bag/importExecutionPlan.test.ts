import { describe, expect, it } from 'vitest';
import { maakBagImportUitvoerplan, beoordeelBagImportVoortgang } from './importExecutionPlan';
import type { BagBronpakketManifest } from './sourceManifest';

const manifest: BagBronpakketManifest = {
  manifestVersie: 1,
  scopeCode: '0363',
  scopeNaam: 'Amsterdam',
  leverancier: 'Kadaster',
  product: 'BAG Extract',
  leverdatum: '2026-08-01',
  ontvangenOp: '2026-08-04',
  bronUrlRegistratie: 'intern geregistreerd',
  bestanden: [
    { pad: 'objecten.xml', sha256: 'a'.repeat(64), bytes: 1, type: 'objecten' },
    { pad: 'voorkomens.xml', sha256: 'b'.repeat(64), bytes: 1, type: 'voorkomens' },
    { pad: 'relaties.xml', sha256: 'c'.repeat(64), bytes: 1, type: 'relaties' },
    { pad: 'geometrieen.xml', sha256: 'd'.repeat(64), bytes: 1, type: 'geometrieen' },
  ],
  verwachteTellingen: { objecten: 250_001, voorkomens: 1, relaties: 1, geometrieen: 1 },
};

describe('BAG importuitvoerplan', () => {
  it('verdeelt de import deterministisch in hervatbare tranches', () => {
    const plan = maakBagImportUitvoerplan({ manifest, datasetversieId: 'ds-1', trancheGrootte: 100_000 });
    expect(plan.tranches.map(item => item.verwachtAantalObjecten)).toEqual([100_000, 100_000, 50_001]);
    expect(plan.hervattenVanafTranche).toBe(1);
    expect(plan.allowlistsGeblokkeerd).toBe(true);
  });

  it('hervat bij de eerste niet-afgeronde tranche', () => {
    const plan = maakBagImportUitvoerplan({ manifest, datasetversieId: 'ds-1', afgerondeTranches: [1, 2] });
    expect(plan.hervattenVanafTranche).toBe(3);
  });

  it('blokkeert faseovergang wanneer tranches ontbreken of rollback is uitgevoerd', () => {
    const plan = maakBagImportUitvoerplan({ manifest, datasetversieId: 'ds-1' });
    const resultaat = beoordeelBagImportVoortgang(plan, {
      afgerondeTranches: [1],
      fase: 'staging_geladen',
      rollbackUitgevoerd: true,
    });
    expect(resultaat.gereedVoorVolgendeFase).toBe(false);
    expect(resultaat.blokkades.length).toBeGreaterThanOrEqual(2);
  });
});
