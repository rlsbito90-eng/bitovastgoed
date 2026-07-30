import { describe, expect, it } from 'vitest';
import {
  assessSourcePackage,
  isCurrencyUnitCode,
  packageSnapshot,
  type SourcePackageEntry,
  type VastgoedrekenenSourcePackage,
} from '@/lib/vastgoedrekenen/sourcePackages';

function sourcePackage(patch: Partial<VastgoedrekenenSourcePackage> = {}): VastgoedrekenenSourcePackage {
  return {
    id: 'package-1',
    code: 'bouwkosten_randstad',
    versie: 1,
    naam: 'Bouwkosten Randstad',
    status: 'concept',
    bron_type: 'extern',
    bron_naam: 'Controleerbare kostenbron',
    bron_referentie: 'Rapport 2026, tabel 4',
    bron_versie: '2026-Q2',
    prijspeildatum: '2026-06-30',
    geldig_vanaf: '2026-07-01',
    vervaldatum: '2027-01-01',
    valuta_code: 'EUR',
    geografische_scope: 'Randstad',
    location_keys: ['PV28'],
    meetgrondslag: 'Euro per m² BVO, exclusief btw',
    scope_inclusief: 'Directe bouwkosten en normale aannemersopslag',
    scope_exclusief: 'Grond, honoraria, financiering en btw',
    indexeringsmethode: 'Per kwartaal herijken op dezelfde bronreeks',
    betrouwbaarheid: 'middel',
    toelichting: null,
    system_managed: false,
    goedgekeurd_door: null,
    goedgekeurd_op: null,
    created_by: 'user-1',
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
    ...patch,
  };
}

function entry(patch: Partial<SourcePackageEntry> = {}): SourcePackageEntry {
  return {
    id: 'entry-1',
    code: 'bouwkosten_kantoor',
    naam: 'Bouwkosten kantoor',
    actief: true,
    bronpakket_id: 'package-1',
    bron_type: 'extern',
    bron_naam: 'Controleerbare kostenbron',
    bron_peildatum: '2026-06-30',
    geldig_vanaf: '2026-07-01',
    vervaldatum: '2027-01-01',
    unit_code: 'eur_m2_bvo',
    vat_treatment_code: 'ex_vat',
    ...patch,
  };
}

describe('Fase 6D.1 bronpakketgovernance', () => {
  it('markeert een volledig concept met consistente regels als goedkeuringsgereed', () => {
    const assessment = assessSourcePackage(sourcePackage(), [entry()], '2026-07-30');

    expect(assessment).toMatchObject({
      canApprove: true,
      healthy: false,
      healthStatus: 'gereed',
      linkedEntries: 1,
      activeEntries: 1,
      expiredEntries: 0,
    });
    expect(assessment.issues).toEqual([]);
  });

  it('blokkeert goedkeuring wanneer pakketvelden of gekoppelde regels ontbreken', () => {
    const assessment = assessSourcePackage(
      sourcePackage({ geografische_scope: null, scope_exclusief: null }),
      [],
      '2026-07-30',
    );

    expect(assessment.canApprove).toBe(false);
    expect(assessment.healthStatus).toBe('concept');
    expect(assessment.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing_package_field',
      'no_entries',
    ]));
  });

  it('vereist bij een eurogrondslag een expliciete btw-behandeling', () => {
    const assessment = assessSourcePackage(sourcePackage(), [entry({ vat_treatment_code: null })], '2026-07-30');

    expect(assessment.canApprove).toBe(false);
    expect(assessment.issues).toContainEqual(expect.objectContaining({ code: 'missing_vat_treatment' }));
    expect(isCurrencyUnitCode('eur_m2_bvo')).toBe(true);
    expect(isCurrencyUnitCode('percent')).toBe(false);
  });

  it('detecteert afwijkende bron-, prijspeil- en geldigheidsmetadata per regel', () => {
    const assessment = assessSourcePackage(sourcePackage(), [entry({
      bron_type: 'projectspecifiek',
      bron_naam: 'Andere bron',
      bron_peildatum: '2026-05-01',
      geldig_vanaf: '2026-06-01',
      vervaldatum: '2026-12-01',
    })], '2026-07-30');

    expect(assessment.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'source_type_mismatch',
      'source_name_mismatch',
      'price_level_mismatch',
      'validity_mismatch',
    ]));
  });

  it('markeert een verstreken goedgekeurd pakket als verlopen', () => {
    const assessment = assessSourcePackage(
      sourcePackage({ status: 'goedgekeurd', vervaldatum: '2026-07-01', goedgekeurd_op: '2026-06-01T00:00:00Z' }),
      [entry({ vervaldatum: '2026-07-01' })],
      '2026-07-30',
    );

    expect(assessment.healthStatus).toBe('verlopen');
    expect(assessment.healthy).toBe(false);
    expect(assessment.expiredEntries).toBe(1);
  });

  it('maakt een beperkte, onveranderlijke pakketmomentopname voor scenario-snapshots', () => {
    const snapshot = packageSnapshot(sourcePackage({ goedgekeurd_op: '2026-07-30T10:00:00Z' }));

    expect(snapshot).toMatchObject({
      id: 'package-1',
      code: 'bouwkosten_randstad',
      versie: 1,
      prijspeildatum: '2026-06-30',
      meetgrondslag: 'Euro per m² BVO, exclusief btw',
      goedgekeurd_op: '2026-07-30T10:00:00Z',
    });
    expect(snapshot).not.toHaveProperty('created_by');
    expect(snapshot).not.toHaveProperty('updated_at');
  });
});
