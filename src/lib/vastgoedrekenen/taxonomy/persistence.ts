import { mapLegacyStrategy } from './legacyMapping';
import {
  isBusinessCase,
  isDisposition,
  isExpansionSubtype,
  isExploitationMode,
  isIntervention,
} from './resolution';
import type {
  CanonicalScenarioTaxonomy,
  TaxonomyConfidence,
  TaxonomyIssue,
  TaxonomyValidationMode,
} from './types';
import { validateScenarioTaxonomy } from './validation';

export const SCENARIO_TAXONOMY_SCHEMA_VERSION = 1;

/**
 * Additieve databasekolommen naast de bestaande legacyvelden.
 * De kolommen blijven nullable totdat een scenario expliciet canoniek is geclassificeerd.
 */
export interface PersistedScenarioTaxonomyColumns {
  business_case?: unknown;
  intervention?: unknown;
  expansion_subtype?: unknown;
  exploitation_mode?: unknown;
  disposition?: unknown;
  taxonomy_schema_version?: unknown;
  strategy_type?: unknown;
}

export type ScenarioTaxonomyReadSource = 'canonical' | 'mixed' | 'legacy';

export interface PersistedScenarioTaxonomyResolution {
  value: CanonicalScenarioTaxonomy;
  source: ScenarioTaxonomyReadSource;
  schemaVersion: number | null;
  confidence: TaxonomyConfidence;
  warnings: string[];
  validationIssues: TaxonomyIssue[];
}

export interface ScenarioTaxonomyPersistencePatch {
  business_case: CanonicalScenarioTaxonomy['businessCase'];
  intervention: CanonicalScenarioTaxonomy['intervention'];
  expansion_subtype: CanonicalScenarioTaxonomy['expansionSubtype'];
  exploitation_mode: CanonicalScenarioTaxonomy['exploitation'];
  disposition: CanonicalScenarioTaxonomy['disposition'];
  taxonomy_schema_version: number;
}

export interface ScenarioTaxonomyClearPatch {
  business_case: null;
  intervention: null;
  expansion_subtype: null;
  exploitation_mode: null;
  disposition: null;
  taxonomy_schema_version: null;
}

export class ScenarioTaxonomyPersistenceError extends Error {
  readonly issues: TaxonomyIssue[];

  constructor(message: string, issues: TaxonomyIssue[] = []) {
    super(message);
    this.name = 'ScenarioTaxonomyPersistenceError';
    this.issues = issues;
  }
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function resolveSchemaVersion(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function taxonomyFromLegacy(record: PersistedScenarioTaxonomyColumns) {
  return mapLegacyStrategy(record.strategy_type).mapping;
}

function taxonomyValueFromLegacy(record: PersistedScenarioTaxonomyColumns): CanonicalScenarioTaxonomy {
  const legacy = taxonomyFromLegacy(record);
  return {
    businessCase: legacy.businessCase,
    intervention: legacy.intervention,
    expansionSubtype: legacy.expansionSubtype,
    exploitation: legacy.exploitation,
    disposition: legacy.disposition,
  };
}

function validationMessages(issues: TaxonomyIssue[]): string[] {
  return issues.map((issue) => issue.message);
}

/**
 * Dual-read contract:
 * 1. een volledig en gemarkeerd canoniek record is leidend;
 * 2. een gedeeltelijk record wordt per veld veilig aangevuld vanuit de legacystrategie;
 * 3. zonder canonieke opslag blijft de bestaande legacystrategie volledig leidend.
 *
 * Deze functie schrijft niets terug en voert geen automatische migratie uit.
 */
export function resolvePersistedScenarioTaxonomy(
  record: PersistedScenarioTaxonomyColumns,
): PersistedScenarioTaxonomyResolution {
  const legacyResolution = mapLegacyStrategy(record.strategy_type);
  const legacy = legacyResolution.mapping;
  const schemaVersion = resolveSchemaVersion(record.taxonomy_schema_version);

  const businessCaseValid = isBusinessCase(record.business_case);
  const interventionValid = isIntervention(record.intervention);
  const expansionValid = record.expansion_subtype === null || isExpansionSubtype(record.expansion_subtype);
  const exploitationValid = isExploitationMode(record.exploitation_mode);
  const dispositionValid = isDisposition(record.disposition);

  const canonicalSignalPresent = [
    record.business_case,
    record.intervention,
    record.expansion_subtype,
    record.exploitation_mode,
    record.disposition,
    record.taxonomy_schema_version,
  ].some(isPresent);

  const canonicalComplete = schemaVersion !== null
    && businessCaseValid
    && interventionValid
    && expansionValid
    && exploitationValid
    && dispositionValid;

  if (canonicalComplete) {
    const value: CanonicalScenarioTaxonomy = {
      businessCase: record.business_case,
      intervention: record.intervention,
      expansionSubtype: record.expansion_subtype,
      exploitation: record.exploitation_mode,
      disposition: record.disposition,
    };
    const validation = validateScenarioTaxonomy(value, 'draft');
    return {
      value,
      source: 'canonical',
      schemaVersion,
      confidence: validation.valid ? 'exact' : 'ambiguous',
      warnings: validationMessages(validation.issues),
      validationIssues: validation.issues,
    };
  }

  if (!canonicalSignalPresent) {
    const value = taxonomyValueFromLegacy(record);
    const validation = validateScenarioTaxonomy(value, 'draft');
    return {
      value,
      source: 'legacy',
      schemaVersion: null,
      confidence: legacy.confidence,
      warnings: [...legacy.warnings, ...validationMessages(validation.issues)],
      validationIssues: validation.issues,
    };
  }

  const warnings = [...legacy.warnings];
  if (schemaVersion === null) {
    warnings.push('Canonieke taxonomievelden zijn aanwezig zonder geldige schemaversie; legacywaarden zijn gebruikt voor ontbrekende of ongeldige velden.');
  }
  if (!businessCaseValid) warnings.push('Canonieke businesscase ontbreekt of is ongeldig; teruggevallen op de legacystrategie.');
  if (!interventionValid) warnings.push('Canonieke ingreep ontbreekt of is ongeldig; teruggevallen op de legacystrategie.');
  if (!expansionValid) warnings.push('Canoniek uitbreidingstype is ongeldig; teruggevallen op de legacystrategie.');
  if (!exploitationValid) warnings.push('Canonieke exploitatievorm ontbreekt of is ongeldig; teruggevallen op de legacystrategie.');
  if (!dispositionValid) warnings.push('Canonieke disposition ontbreekt of is ongeldig; teruggevallen op de legacystrategie.');

  const value: CanonicalScenarioTaxonomy = {
    businessCase: businessCaseValid ? record.business_case : legacy.businessCase,
    intervention: interventionValid ? record.intervention : legacy.intervention,
    expansionSubtype: expansionValid ? record.expansion_subtype : legacy.expansionSubtype,
    exploitation: exploitationValid ? record.exploitation_mode : legacy.exploitation,
    disposition: dispositionValid ? record.disposition : legacy.disposition,
  };
  const validation = validateScenarioTaxonomy(value, 'draft');
  warnings.push(...validationMessages(validation.issues));

  return {
    value,
    source: 'mixed',
    schemaVersion,
    confidence: warnings.length === 0 && validation.valid ? 'inferred' : 'ambiguous',
    warnings: [...new Set(warnings)],
    validationIssues: validation.issues,
  };
}

/**
 * Maakt één atomaire write-patch. Gedeeltelijke canonieke writes zijn bewust niet toegestaan.
 */
export function scenarioTaxonomyPersistencePatch(
  taxonomy: CanonicalScenarioTaxonomy,
  mode: TaxonomyValidationMode = 'strict',
): ScenarioTaxonomyPersistencePatch {
  if (!isBusinessCase(taxonomy.businessCase)
    || !isIntervention(taxonomy.intervention)
    || (taxonomy.expansionSubtype !== null && !isExpansionSubtype(taxonomy.expansionSubtype))
    || !isExploitationMode(taxonomy.exploitation)
    || !isDisposition(taxonomy.disposition)) {
    throw new ScenarioTaxonomyPersistenceError('Scenario-taxonomie bevat een onbekende canonieke waarde.');
  }

  const validation = validateScenarioTaxonomy(taxonomy, mode);
  if (!validation.valid) {
    throw new ScenarioTaxonomyPersistenceError(
      validation.issues.map((issue) => issue.message).join(' '),
      validation.issues,
    );
  }

  return {
    business_case: taxonomy.businessCase,
    intervention: taxonomy.intervention,
    expansion_subtype: taxonomy.expansionSubtype,
    exploitation_mode: taxonomy.exploitation,
    disposition: taxonomy.disposition,
    taxonomy_schema_version: SCENARIO_TAXONOMY_SCHEMA_VERSION,
  };
}

/** Expliciete reset naar uitsluitend legacy-read; nooit automatisch gebruiken. */
export function clearScenarioTaxonomyPersistencePatch(): ScenarioTaxonomyClearPatch {
  return {
    business_case: null,
    intervention: null,
    expansion_subtype: null,
    exploitation_mode: null,
    disposition: null,
    taxonomy_schema_version: null,
  };
}
