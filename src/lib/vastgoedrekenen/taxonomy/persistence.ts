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

function taxonomyValueFromLegacy(record: PersistedScenarioTaxonomyColumns): CanonicalScenarioTaxonomy {
  const legacy = mapLegacyStrategy(record.strategy_type).mapping;
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
 * 1. een volledig, gemarkeerd én intern consistent canoniek record is leidend;
 * 2. een gedeeltelijk of inconsistent record wordt veilig aangevuld/genormaliseerd;
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

  const businessCaseWaarde = isBusinessCase(record.business_case) ? record.business_case : null;
  const interventionWaarde = isIntervention(record.intervention) ? record.intervention : null;
  const expansionWaarde = isExpansionSubtype(record.expansion_subtype) ? record.expansion_subtype : null;
  const exploitationWaarde = isExploitationMode(record.exploitation_mode) ? record.exploitation_mode : null;
  const dispositionWaarde = isDisposition(record.disposition) ? record.disposition : null;

  const businessCaseValid = businessCaseWaarde !== null;
  const interventionValid = interventionWaarde !== null;
  const expansionValid = record.expansion_subtype === null || expansionWaarde !== null;
  const exploitationValid = exploitationWaarde !== null;
  const dispositionValid = dispositionWaarde !== null;


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

  let storedCanonicalIssues: TaxonomyIssue[] = [];
  if (canonicalComplete) {
    const value: CanonicalScenarioTaxonomy = {
      businessCase: businessCaseWaarde!,
      intervention: interventionWaarde!,
      expansionSubtype: expansionWaarde,
      exploitation: exploitationWaarde!,
      disposition: dispositionWaarde!,

    };
    const validation = validateScenarioTaxonomy(value, 'draft');
    if (validation.valid) {
      return {
        value,
        source: 'canonical',
        schemaVersion,
        confidence: validation.issues.length === 0 ? 'exact' : 'inferred',
        warnings: validationMessages(validation.issues),
        validationIssues: validation.issues,
      };
    }
    storedCanonicalIssues = validation.issues;
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
  if (storedCanonicalIssues.length > 0) {
    warnings.push('De opgeslagen canonieke taxonomie is intern inconsistent en is defensief genormaliseerd.');
    warnings.push(...validationMessages(storedCanonicalIssues));
  }

  let value: CanonicalScenarioTaxonomy = {
    businessCase: businessCaseValid ? record.business_case : legacy.businessCase,
    intervention: interventionValid ? record.intervention : legacy.intervention,
    expansionSubtype: expansionValid ? record.expansion_subtype : legacy.expansionSubtype,
    exploitation: exploitationValid ? record.exploitation_mode : legacy.exploitation,
    disposition: dispositionValid ? record.disposition : legacy.disposition,
  };

  if (value.intervention !== 'expand' && value.expansionSubtype !== null) {
    warnings.push('Het uitbreidingstype is genegeerd omdat de ingreep niet “Uitbreiden” is.');
    value = { ...value, expansionSubtype: null };
  }

  const validation = validateScenarioTaxonomy(value, 'draft');
  warnings.push(...validationMessages(validation.issues));
  const validationIssues = [...storedCanonicalIssues, ...validation.issues];

  return {
    value,
    source: 'mixed',
    schemaVersion,
    confidence: 'ambiguous',
    warnings: [...new Set(warnings)],
    validationIssues,
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
