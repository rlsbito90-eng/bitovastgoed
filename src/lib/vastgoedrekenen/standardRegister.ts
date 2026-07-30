import {
  ASSUMPTION_PROFILES,
  PROPERTY_ASSUMPTION_TYPE_LABELS,
  type PropertyAssumptionType,
} from './profiles';
import type {
  KengetalScenarioVeld,
  VastgoedrekenenKengetal,
} from './kengetallen';

export const STANDARD_REGISTER_PACK_VERSION = 1 as const;
export const STANDARD_REGISTER_CODE_PREFIX = 'bito_quickscan_v1_';
export const STANDARD_REGISTER_VALID_FROM = '2026-07-30';
export const STANDARD_REGISTER_EXPIRES_ON = '2027-01-30';

const ASSET_TYPE_CODES: Record<PropertyAssumptionType, string[]> = {
  residentieel: ['residential'],
  mixed_use: ['mixed_use'],
  retail: ['retail', 'hospitality'],
  kantoor: ['office'],
  bedrijfsruimte: ['light_industrial'],
  logistiek: ['logistics'],
  zorg: ['care'],
};

const METRICS: Array<{
  field: KengetalScenarioVeld;
  slug: string;
  label: string;
}> = [
  { field: 'vacancy_percentage', slug: 'leegstand', label: 'Leegstand' },
  { field: 'operating_cost_percentage', slug: 'exploitatiekosten', label: 'Exploitatiekosten' },
  { field: 'maintenance_reserve_percentage', slug: 'onderhoudsreserve', label: 'Onderhoudsreserve' },
  { field: 'management_cost_percentage', slug: 'beheerkosten', label: 'Beheerkosten' },
];

export type StandardRegisterSeed = {
  code: string;
  naam: string;
  minimum_waarde: number;
  basis_waarde: number;
  maximum_waarde: number;
  scenario_veld: KengetalScenarioVeld;
  asset_type_codes: string[];
  project_phase_codes: string[];
  conservative_band: 'maximum';
  optimistic_band: 'minimum';
};

export function buildStandardRegisterPackV1(): StandardRegisterSeed[] {
  return (Object.keys(ASSUMPTION_PROFILES) as PropertyAssumptionType[]).flatMap((assetType) => {
    const profile = ASSUMPTION_PROFILES[assetType];
    return METRICS.map((metric) => ({
      code: `${STANDARD_REGISTER_CODE_PREFIX}${assetType}_${metric.slug}`,
      naam: `${metric.label} — ${PROPERTY_ASSUMPTION_TYPE_LABELS[assetType]} quickscan`,
      minimum_waarde: profile.licht[metric.field],
      basis_waarde: profile.normaal[metric.field],
      maximum_waarde: profile.conservatief[metric.field],
      scenario_veld: metric.field,
      asset_type_codes: [...ASSET_TYPE_CODES[assetType]],
      project_phase_codes: ['quickscan'],
      conservative_band: 'maximum',
      optimistic_band: 'minimum',
    }));
  });
}

export const STANDARD_REGISTER_PACK_V1 = buildStandardRegisterPackV1();
export const STANDARD_REGISTER_CODES = STANDARD_REGISTER_PACK_V1.map((item) => item.code);

export type StandardRegisterCoverage = {
  expected: number;
  present: number;
  active: number;
  expired: number;
  inactive: number;
  missingCodes: string[];
  complete: boolean;
};

export function assessStandardRegisterCoverage(
  entries: readonly Pick<VastgoedrekenenKengetal, 'code' | 'actief' | 'vervaldatum'>[],
  todayIso = new Date().toISOString().slice(0, 10),
): StandardRegisterCoverage {
  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  const expectedEntries = STANDARD_REGISTER_CODES
    .map((code) => byCode.get(code))
    .filter((entry): entry is Pick<VastgoedrekenenKengetal, 'code' | 'actief' | 'vervaldatum'> => Boolean(entry));
  const missingCodes = STANDARD_REGISTER_CODES.filter((code) => !byCode.has(code));
  const active = expectedEntries.filter((entry) => entry.actief).length;
  const expired = expectedEntries.filter((entry) => entry.vervaldatum < todayIso).length;
  const inactive = expectedEntries.filter((entry) => !entry.actief).length;

  return {
    expected: STANDARD_REGISTER_CODES.length,
    present: expectedEntries.length,
    active,
    expired,
    inactive,
    missingCodes,
    complete: missingCodes.length === 0 && inactive === 0 && expired === 0,
  };
}
