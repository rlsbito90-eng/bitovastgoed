import { describe, expect, it } from 'vitest';
import { evalueerAmsterdamImportPakket, type AmsterdamImportGateInvoer } from './amsterdamImportPakket';

const BASIS: AmsterdamImportGateInvoer = {
  datasetVersie: 'v20260805',
  scopeCode: '0363',
  geselecteerdAantal: 100,
  selectieChecksum: 'e'.repeat(64),
  bronSha256: 'f'.repeat(64),
  bestanden: [{ bestand: 'objecten.csv', tabel: 'bag_staging.objecten', regels: 80, sha256: '1'.repeat(64) }],
  samenvatting: {
    ontvangen: 100,
    verwerkt: 100,
    adapterFouten: 0,
    stagingFouten: 0,
    objecten: 80,
    voorkomens: 100,
    relatiesBron: 80,
    relatiesUniek: 75,
    geometrieen: 90,
    overgeslagenGeometrieen: 0,
    ontbrekendeVoorkomenkoppelingen: 0,
    ambigueVoorkomenkoppelingen: 0,
  },
};

function met(overrides: Partial<AmsterdamImportGateInvoer['samenvatting']>) {
  return evalueerAmsterdamImportPakket({ ...BASIS, samenvatting: { ...BASIS.samenvatting, ...overrides } });
}

describe('Amsterdam importpakket-poort', () => {
  it('geeft GO wanneer meerdere voorkomens bij minder unieke objecten horen', () => {
    const manifest = evalueerAmsterdamImportPakket(BASIS);
    expect(manifest.besluit).toBe('GO');
    expect(manifest.stopCondities).toHaveLength(0);
    expect(manifest.databaseImportUitgevoerd).toBe(false);
    expect(manifest.schemaversie).toBe('bag-2a3b-private-schema-kandidaat');
  });

  it('stopt bij dataverlies in ontvangen, verwerkt of voorkomens', () => {
    expect(met({ verwerkt: 99 }).stopCondities.map(s => s.code)).toContain('dataverlies');
    expect(met({ voorkomens: 99 }).stopCondities.map(s => s.code)).toContain('dataverlies');
    expect(met({ objecten: 0 }).stopCondities.map(s => s.code)).toContain('dataverlies');
    expect(met({ objecten: 101 }).stopCondities.map(s => s.code)).toContain('dataverlies');
  });

  it('stopt bij ontbrekende relaties', () => {
    expect(met({ relatiesBron: 0, relatiesUniek: 0 }).stopCondities.map(s => s.code)).toContain('ontbrekende_relaties');
    expect(met({ relatiesUniek: 0 }).stopCondities.map(s => s.code)).toContain('ontbrekende_relaties');
  });

  it('stopt bij ambigue geometriekoppelingen', () => {
    expect(met({ ambigueVoorkomenkoppelingen: 2 }).stopCondities.map(s => s.code)).toContain('ambigue_koppelingen');
  });

  it('stopt bij geometrieverlies', () => {
    const manifest = met({ overgeslagenGeometrieen: 3, ontbrekendeVoorkomenkoppelingen: 3 });
    expect(manifest.stopCondities.map(s => s.code)).toContain('geometrieverlies');
    expect(manifest.quarantaine).toBe(3);
  });

  it('stopt bij quarantaine door parse- of stagingfouten', () => {
    expect(met({ adapterFouten: 1 }).stopCondities.map(s => s.code)).toContain('quarantaine');
    expect(met({ stagingFouten: 4 }).besluit).toBe('STOP');
  });
});
