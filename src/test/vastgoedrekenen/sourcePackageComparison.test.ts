import { describe, expect, it } from 'vitest';
import type { VastgoedrekenenKengetal } from '@/lib/vastgoedrekenen/kengetallen';
import type { VastgoedrekenenSourcePackage } from '@/lib/vastgoedrekenen/sourcePackages';
import {
  canApproveSourcePackageComparison,
  compareSourcePackageVersions,
} from '@/lib/vastgoedrekenen/sourcePackageComparison';

function pkg(overrides: Partial<VastgoedrekenenSourcePackage> = {}): VastgoedrekenenSourcePackage {
  return {
    id: 'package-v1', code: 'BOUWKOSTEN_NL', versie: 1, naam: 'Bouwkosten Nederland', status: 'goedgekeurd',
    bron_type: 'extern', bron_naam: 'Bron', bron_referentie: 'https://example.test', bron_versie: '2025',
    prijspeildatum: '2025-01-01', geldig_vanaf: '2025-01-01', vervaldatum: '2025-12-31', valuta_code: 'EUR',
    geografische_scope: 'Nederland', location_keys: [], meetgrondslag: 'BVO', scope_inclusief: 'Bouwkosten',
    scope_exclusief: 'Grond', indexeringsmethode: 'Jaarlijks', betrouwbaarheid: 'hoog', toelichting: null,
    system_managed: false, goedgekeurd_door: 'reviewer', goedgekeurd_op: '2025-01-01T00:00:00Z',
    created_by: 'author', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function entry(overrides: Partial<VastgoedrekenenKengetal> = {}): VastgoedrekenenKengetal {
  return {
    id: 'entry-v1', code: 'KANTOOR_TRANSFORMATIE_BASIS', naam: 'Kantoortransformatie basisprijs', categorie: 'bouwkosten',
    eenheid: '€/m² BVO', minimum_waarde: 1300, basis_waarde: 1450, maximum_waarde: 1600,
    conservative_band: 'maximum', optimistic_band: 'minimum', scenario_veld: null, bron_type: 'extern', bron_naam: 'Bron',
    bron_referentie: 'https://example.test', bron_peildatum: '2025-01-01', geldig_vanaf: '2025-01-01', vervaldatum: '2025-12-31',
    toepassingsgebied: ['transformatie'], regio: ['Nederland'], projectfase: ['haalbaarheid'], risicoklasse: [],
    betrouwbaarheid: 'hoog', toelichting: null, actief: true, versie: 1, created_by: 'author',
    created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    asset_type_codes: ['office'], strategy_codes: ['transformation'], project_phase_codes: ['feasibility'], risk_class_codes: [],
    quality_level_codes: [], complexity_codes: [], location_type_codes: [], market_condition_codes: [], scenario_profile_codes: [],
    location_keys: [], unit_code: 'eur_m2_bvo', vat_treatment_code: 'excl_vat', classification_schema_version: 1,
    ...overrides,
  };
}

describe('compareSourcePackageVersions', () => {
  it('berekent absolute en relatieve mutaties deterministisch', () => {
    const result = compareSourcePackageVersions({
      previousPackage: pkg(),
      nextPackage: pkg({ id: 'package-v2', versie: 2, prijspeildatum: '2026-01-01' }),
      previousEntries: [entry()],
      nextEntries: [entry({ id: 'entry-v2', versie: 2, basis_waarde: 1560, bron_peildatum: '2026-01-01' })],
      calculatedAt: '2026-07-31T10:00:00Z',
    });
    const mutation = result.entries[0].fieldChanges.find((change) => change.field === 'basis_waarde')?.mutation;
    expect(mutation?.absoluteDifference).toBe(110);
    expect(mutation?.relativeMutationPercentage).toBeCloseTo(7.5862, 4);
    expect(mutation?.direction).toBe('stijging');
    expect(result.summary.changedCount).toBe(1);
    expect(result.summary.previousPriceLevelDate).toBe('2025-01-01');
    expect(result.summary.nextPriceLevelDate).toBe('2026-01-01');
  });

  it('herkent toegevoegde, vervallen en ongewijzigde codes', () => {
    const unchanged = entry({ code: 'A', id: 'a1' });
    const removed = entry({ code: 'B', id: 'b1' });
    const added = entry({ code: 'C', id: 'c2', versie: 2 });
    const result = compareSourcePackageVersions({
      previousPackage: pkg(), nextPackage: pkg({ id: 'package-v2', versie: 2 }),
      previousEntries: [unchanged, removed], nextEntries: [{ ...unchanged, id: 'a2', versie: 2 }, added],
    });
    expect(result.entries.map((item) => [item.code, item.changeType])).toEqual([
      ['A', 'ongewijzigd'], ['B', 'vervallen'], ['C', 'toegevoegd'],
    ]);
  });

  it('blokkeert directe waardevergelijking wanneer de eenheid wijzigt', () => {
    const result = compareSourcePackageVersions({
      previousPackage: pkg(), nextPackage: pkg({ id: 'package-v2', versie: 2 }),
      previousEntries: [entry()],
      nextEntries: [entry({ id: 'entry-v2', versie: 2, unit_code: 'eur_m2_gbo', eenheid: '€/m² GBO', basis_waarde: 1560 })],
    });
    const mutation = result.entries[0].fieldChanges.find((change) => change.field === 'basis_waarde')?.mutation;
    expect(mutation?.comparability).toBe('niet_direct_vergelijkbaar');
    expect(mutation?.relativeMutationPercentage).toBeNull();
    expect(result.entries[0].warnings.some((warning) => warning.code === 'unit_changed' && warning.severity === 'kritiek')).toBe(true);
  });

  it('waarschuwt en markeert kritieke grote mutaties via centrale drempels', () => {
    const result = compareSourcePackageVersions({
      previousPackage: pkg(), nextPackage: pkg({ id: 'package-v2', versie: 2 }),
      previousEntries: [entry()], nextEntries: [entry({ id: 'entry-v2', versie: 2, basis_waarde: 2000 })],
      config: { warningPercentage: 10, criticalPercentage: 25 },
    });
    expect(result.summary.criticalWarningCount).toBe(1);
    expect(result.warnings[0].code).toBe('critical_mutation');
  });

  it('handelt een vorige nulwaarde af zonder oneindig percentage', () => {
    const result = compareSourcePackageVersions({
      previousPackage: pkg(), nextPackage: pkg({ id: 'package-v2', versie: 2 }),
      previousEntries: [entry({ basis_waarde: 0 })], nextEntries: [entry({ id: 'entry-v2', versie: 2, basis_waarde: 100 })],
    });
    const mutation = result.entries[0].fieldChanges.find((change) => change.field === 'basis_waarde')?.mutation;
    expect(mutation?.absoluteDifference).toBe(100);
    expect(mutation?.relativeMutationPercentage).toBeNull();
  });

  it('weigert vergelijking van verschillende bronpakketfamilies en omgekeerde versies', () => {
    expect(() => compareSourcePackageVersions({
      previousPackage: pkg(), nextPackage: pkg({ id: 'other', code: 'ANDER', versie: 2 }), previousEntries: [], nextEntries: [],
    })).toThrow(/dezelfde bronpakketcode/);
    expect(() => compareSourcePackageVersions({
      previousPackage: pkg({ versie: 2 }), nextPackage: pkg({ id: 'older', versie: 1 }), previousEntries: [], nextEntries: [],
    })).toThrow(/hoger/);
  });
});

describe('canApproveSourcePackageComparison', () => {
  it('vereist beoordeling en erkenning van kritieke waarschuwingen', () => {
    const comparison = compareSourcePackageVersions({
      previousPackage: pkg(), nextPackage: pkg({ id: 'package-v2', versie: 2 }),
      previousEntries: [entry()], nextEntries: [entry({ id: 'entry-v2', versie: 2, basis_waarde: 2000 })],
    });
    expect(canApproveSourcePackageComparison({ status: 'concept', comparison, criticalWarningsAcknowledged: true })).toBe(false);
    expect(canApproveSourcePackageComparison({ status: 'te_beoordelen', comparison, criticalWarningsAcknowledged: false })).toBe(false);
    expect(canApproveSourcePackageComparison({ status: 'te_beoordelen', comparison, criticalWarningsAcknowledged: true })).toBe(true);
  });
});
