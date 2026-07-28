import {
  BUSINESS_CASE_METADATA,
  DISPOSITION_METADATA,
  EXPANSION_SUBTYPE_METADATA,
  EXPLOITATION_MODE_METADATA,
  INTERVENTION_METADATA,
  type BusinessCase,
  type Disposition,
  type ExpansionSubtype,
  type ExploitationMode,
  type Intervention,
  type ResolvedScenarioTaxonomy,
  type RuntimeScenarioTaxonomyInput,
} from './types';

function isMetadataKey<T extends object>(metadata: T, value: unknown): value is Extract<keyof T, string> {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(metadata, value);
}

export const isBusinessCase = (value: unknown): value is BusinessCase =>
  isMetadataKey(BUSINESS_CASE_METADATA, value);

export const isIntervention = (value: unknown): value is Intervention =>
  isMetadataKey(INTERVENTION_METADATA, value);

export const isExpansionSubtype = (value: unknown): value is ExpansionSubtype =>
  isMetadataKey(EXPANSION_SUBTYPE_METADATA, value);

export const isExploitationMode = (value: unknown): value is ExploitationMode =>
  isMetadataKey(EXPLOITATION_MODE_METADATA, value);

export const isDisposition = (value: unknown): value is Disposition =>
  isMetadataKey(DISPOSITION_METADATA, value);

function warning(field: string, value: unknown, fallback: string): string {
  const shown = typeof value === 'string' && value.trim() ? `“${value}”` : 'een ontbrekende waarde';
  return `${field} bevat ${shown}; teruggevallen op “${fallback}”.`;
}

/**
 * Normaliseert uitsluitend runtimewaarden naar een veilig canoniek contract.
 * Deze helper schrijft niets weg en classificeert geen bestaande records automatisch.
 */
export function resolveScenarioTaxonomy(input: RuntimeScenarioTaxonomyInput): ResolvedScenarioTaxonomy {
  const warnings: string[] = [];

  const businessCase = isBusinessCase(input.businessCase)
    ? input.businessCase
    : (warnings.push(warning('Businesscase', input.businessCase, 'legacy_generic')), 'legacy_generic');

  const intervention = isIntervention(input.intervention)
    ? input.intervention
    : (warnings.push(warning('Ingreep', input.intervention, 'none')), 'none');

  const exploitation = isExploitationMode(input.exploitation)
    ? input.exploitation
    : (warnings.push(warning('Exploitatievorm', input.exploitation, 'undecided')), 'undecided');

  const disposition = isDisposition(input.disposition)
    ? input.disposition
    : (warnings.push(warning('Disposition', input.disposition, 'undecided')), 'undecided');

  let expansionSubtype: ExpansionSubtype | null = null;
  if (input.expansionSubtype === null || input.expansionSubtype === undefined || input.expansionSubtype === '') {
    expansionSubtype = null;
  } else if (isExpansionSubtype(input.expansionSubtype)) {
    expansionSubtype = input.expansionSubtype;
  } else {
    warnings.push(warning('Uitbreidingstype', input.expansionSubtype, 'geen subtype'));
  }

  if (intervention !== 'expand' && expansionSubtype !== null) {
    warnings.push('Een uitbreidingstype is genegeerd omdat de fysieke ingreep niet “Uitbreiden” is.');
    expansionSubtype = null;
  }

  return {
    value: {
      businessCase,
      intervention,
      expansionSubtype,
      exploitation,
      disposition,
    },
    warnings,
  };
}
