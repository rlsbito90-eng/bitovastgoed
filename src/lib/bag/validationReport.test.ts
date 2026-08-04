import { describe, expect, it } from 'vitest';
import { bouwAmsterdamValidatierapport } from './validationReport';
import { maakBagImportUitvoerplan } from './importExecutionPlan';
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
  verwachteTellingen: { objecten: 2, voorkomens: 2, relaties: 2, geometrieen: 2 },
};

describe('Amsterdam validatierapport', () => {
  it('staat publicatie alleen toe na complete en geldige import', () => {
    const plan = maakBagImportUitvoerplan({ manifest, datasetversieId: 'ds-1', trancheGrootte: 1 });
    const rapport = bouwAmsterdamValidatierapport({
      bronvalidatie: { geldig: true, fouten: [], waarschuwingen: [], totaalBytes: 4 },
      plan,
      voortgang: { afgerondeTranches: [1, 2], fase: 'publicatie_gereed', rollbackUitgevoerd: false },
      integriteitGeldig: true,
    });
    expect(rapport.publicatieToegestaan).toBe(true);
    expect(rapport.blokkades).toEqual([]);
  });

  it('blokkeert een onvolledige of teruggedraaide import', () => {
    const plan = maakBagImportUitvoerplan({ manifest, datasetversieId: 'ds-1', trancheGrootte: 1 });
    const rapport = bouwAmsterdamValidatierapport({
      bronvalidatie: { geldig: true, fouten: [], waarschuwingen: [], totaalBytes: 4 },
      plan,
      voortgang: { afgerondeTranches: [1], fase: 'staging_geladen', rollbackUitgevoerd: true },
      integriteitGeldig: false,
    });
    expect(rapport.publicatieToegestaan).toBe(false);
    expect(rapport.blokkades.length).toBeGreaterThanOrEqual(3);
  });
});
