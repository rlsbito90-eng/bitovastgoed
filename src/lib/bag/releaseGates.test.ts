import { describe, expect, it } from 'vitest';
import { beoordeelBagDryRun } from './releaseGates';
import type { BagDryRunRapport } from './importBatch';

function rapport(overrides: Partial<BagDryRunRapport> = {}): BagDryRunRapport {
  return {
    datasetVersie: 'v20200601-assen',
    scopeCode: '0106',
    tellingen: {
      ontvangen: 100,
      verwerkt: 100,
      geweigerd: 0,
      perObjecttype: {
        Pand: 20,
        Verblijfsobject: 20,
        Nummeraanduiding: 20,
        OpenbareRuimte: 10,
        Woonplaats: 1,
        Standplaats: 1,
        Ligplaats: 1,
      },
      objecten: 73,
      voorkomens: 100,
      relaties: 80,
      geometrieen: 43,
    },
    waarschuwingen: [],
    fouten: [],
    fingerprint: 'fingerprint',
    hervatbaarVanaf: null,
    ...overrides,
  };
}

const configuratie = {
  verplichteObjecttypen: ['Pand', 'Verblijfsobject', 'Nummeraanduiding', 'OpenbareRuimte', 'Woonplaats', 'Standplaats', 'Ligplaats'],
  maximaalFoutpercentage: 0.01,
  minimaleRelatiedekking: 0.5,
  vereisGeometrieen: true,
  verwachteDatasetVersie: 'v20200601-assen',
};

describe('beoordeelBagDryRun', () => {
  it('laat een volledig sluitende dry-run door', () => {
    expect(beoordeelBagDryRun(rapport(), configuratie)).toMatchObject({ toegestaan: true, blokkades: [] });
  });

  it('blokkeert een afwijkende datasetversie en ontbrekende objecttypen', () => {
    const result = beoordeelBagDryRun(rapport({
      datasetVersie: 'onverwacht',
      tellingen: { ...rapport().tellingen, perObjecttype: { Pand: 1 } },
    }), configuratie);
    expect(result.toegestaan).toBe(false);
    expect(result.metingen.ontbrekendeObjecttypen).toContain('Verblijfsobject');
    expect(result.blokkades.some(item => item.includes('Datasetversie'))).toBe(true);
  });

  it('blokkeert te veel fouten, onvolledige verwerking en onverantwoorde afwijzingen', () => {
    const result = beoordeelBagDryRun(rapport({
      tellingen: { ...rapport().tellingen, verwerkt: 99, geweigerd: 2 },
      fouten: ['één'],
      hervatbaarVanaf: 99,
    }), configuratie);
    expect(result.toegestaan).toBe(false);
    expect(result.blokkades.length).toBeGreaterThanOrEqual(3);
  });
});
