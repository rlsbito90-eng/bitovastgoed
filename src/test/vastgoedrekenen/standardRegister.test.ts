import { describe, expect, it } from 'vitest';
import { ASSUMPTION_PROFILES } from '@/lib/vastgoedrekenen/profiles';
import {
  STANDARD_REGISTER_CODE_PREFIX,
  STANDARD_REGISTER_CODES,
  STANDARD_REGISTER_PACK_V1,
  assessStandardRegisterCoverage,
} from '@/lib/vastgoedrekenen/standardRegister';

describe('Fase 6C standaardregister', () => {
  it('bevat precies zeven assetgroepen maal vier exploitatievelden', () => {
    expect(STANDARD_REGISTER_PACK_V1).toHaveLength(28);
    expect(new Set(STANDARD_REGISTER_CODES).size).toBe(28);
    expect(STANDARD_REGISTER_CODES.every((code) => code.startsWith(STANDARD_REGISTER_CODE_PREFIX))).toBe(true);
  });

  it('neemt voor kantoorleegstand licht, normaal en conservatief over uit de bestaande CRM-profielen', () => {
    const entry = STANDARD_REGISTER_PACK_V1.find((item) => item.code === 'bito_quickscan_v1_kantoor_leegstand');

    expect(entry).toMatchObject({
      minimum_waarde: ASSUMPTION_PROFILES.kantoor.licht.vacancy_percentage,
      basis_waarde: ASSUMPTION_PROFILES.kantoor.normaal.vacancy_percentage,
      maximum_waarde: ASSUMPTION_PROFILES.kantoor.conservatief.vacancy_percentage,
      conservative_band: 'maximum',
      optimistic_band: 'minimum',
      asset_type_codes: ['office'],
      project_phase_codes: ['quickscan'],
    });
  });

  it('behandelt retail en horeca als dezelfde bestaande quickscanprofielgroep', () => {
    const entry = STANDARD_REGISTER_PACK_V1.find((item) => item.code === 'bito_quickscan_v1_retail_beheerkosten');

    expect(entry).toMatchObject({
      scenario_veld: 'management_cost_percentage',
      asset_type_codes: ['retail', 'hospitality'],
    });
  });

  it('gebruikt zwaar/risicovol bewust niet als automatische maximumband', () => {
    const entry = STANDARD_REGISTER_PACK_V1.find((item) => item.code === 'bito_quickscan_v1_kantoor_leegstand');

    expect(entry?.maximum_waarde).toBe(ASSUMPTION_PROFILES.kantoor.conservatief.vacancy_percentage);
    expect(entry?.maximum_waarde).not.toBe(ASSUMPTION_PROFILES.kantoor.zwaar.vacancy_percentage);
  });

  it('rapporteert ontbrekende, inactieve en verlopen standaardregels afzonderlijk', () => {
    const [first, second] = STANDARD_REGISTER_CODES;
    const coverage = assessStandardRegisterCoverage([
      { code: first, actief: true, vervaldatum: '2027-01-30' },
      { code: second, actief: false, vervaldatum: '2026-01-01' },
      { code: 'eigen_projectkengetal', actief: true, vervaldatum: '2030-01-01' },
    ], '2026-07-30');

    expect(coverage).toMatchObject({
      expected: 28,
      present: 2,
      active: 1,
      inactive: 1,
      expired: 1,
      complete: false,
    });
    expect(coverage.missingCodes).toHaveLength(26);
  });

  it('markeert een volledig, actief en geldig pakket als compleet', () => {
    const coverage = assessStandardRegisterCoverage(
      STANDARD_REGISTER_CODES.map((code) => ({ code, actief: true, vervaldatum: '2027-01-30' })),
      '2026-07-30',
    );

    expect(coverage).toEqual({
      expected: 28,
      present: 28,
      active: 28,
      expired: 0,
      inactive: 0,
      missingCodes: [],
      complete: true,
    });
  });
});
