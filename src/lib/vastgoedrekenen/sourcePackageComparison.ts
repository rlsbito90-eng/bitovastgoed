import type { VastgoedrekenenKengetal } from './kengetallen';
import type { VastgoedrekenenSourcePackage } from './sourcePackages';

export const SOURCE_PACKAGE_COMPARISON_ALGORITHM_VERSION = 1;

export type SourcePackageComparisonStatus = 'concept' | 'te_beoordelen' | 'goedgekeurd' | 'afgekeurd';
export type SourcePackageEntryChangeType = 'toegevoegd' | 'vervallen' | 'gewijzigd' | 'ongewijzigd';
export type SourcePackageMutationDirection = 'stijging' | 'daling' | 'gelijk' | 'niet_bepaalbaar';
export type SourcePackageComparability = 'direct_vergelijkbaar' | 'niet_direct_vergelijkbaar' | 'niet_van_toepassing';
export type SourcePackageWarningSeverity = 'waarschuwing' | 'kritiek';

export type SourcePackageComparedField =
  | 'minimum_waarde'
  | 'basis_waarde'
  | 'maximum_waarde'
  | 'unit_code'
  | 'vat_treatment_code'
  | 'categorie'
  | 'scenario_veld'
  | 'classificatie'
  | 'scope'
  | 'prijspeildatum';

export type SourcePackageComparisonConfig = {
  warningPercentage: number;
  criticalPercentage: number;
};

export const DEFAULT_SOURCE_PACKAGE_COMPARISON_CONFIG: SourcePackageComparisonConfig = {
  warningPercentage: 15,
  criticalPercentage: 30,
};

export type SourcePackageValueMutation = {
  previousValue: number | null;
  nextValue: number | null;
  absoluteDifference: number | null;
  relativeMutationPercentage: number | null;
  direction: SourcePackageMutationDirection;
  comparability: SourcePackageComparability;
};

export type SourcePackageFieldChange = {
  field: SourcePackageComparedField;
  previousValue: unknown;
  nextValue: unknown;
  mutation?: SourcePackageValueMutation;
};

export type SourcePackageComparisonWarning = {
  code:
    | 'large_mutation'
    | 'critical_mutation'
    | 'unit_changed'
    | 'vat_treatment_changed'
    | 'price_level_changed'
    | 'scope_changed'
    | 'classification_changed'
    | 'missing_core_value'
    | 'not_directly_comparable';
  severity: SourcePackageWarningSeverity;
  message: string;
  entryCode?: string;
  field?: SourcePackageComparedField;
};

export type SourcePackageEntryComparison = {
  code: string;
  name: string;
  changeType: SourcePackageEntryChangeType;
  previousEntry: VastgoedrekenenKengetal | null;
  nextEntry: VastgoedrekenenKengetal | null;
  fieldChanges: SourcePackageFieldChange[];
  warnings: SourcePackageComparisonWarning[];
};

export type SourcePackageComparisonSummary = {
  previousCodeCount: number;
  nextCodeCount: number;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  warningCount: number;
  criticalWarningCount: number;
  largestIncreasePercentage: number | null;
  largestDecreasePercentage: number | null;
  previousPriceLevelDate: string | null;
  nextPriceLevelDate: string | null;
};

export type SourcePackageVersionComparison = {
  packageCode: string;
  previousPackageId: string;
  nextPackageId: string;
  previousVersion: number;
  nextVersion: number;
  status: SourcePackageComparisonStatus;
  entries: SourcePackageEntryComparison[];
  warnings: SourcePackageComparisonWarning[];
  summary: SourcePackageComparisonSummary;
  calculatedAt: string;
  algorithmVersion: number;
};

const CLASSIFICATION_KEYS = [
  'asset_type_codes',
  'strategy_codes',
  'project_phase_codes',
  'risk_class_codes',
  'quality_level_codes',
  'complexity_codes',
  'location_type_codes',
  'market_condition_codes',
  'scenario_profile_codes',
  'location_keys',
] as const;

function stableArray(value: readonly string[] | null | undefined): string[] {
  return [...(value ?? [])].sort((a, b) => a.localeCompare(b));
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function numericMutation(
  previousValue: number | null | undefined,
  nextValue: number | null | undefined,
  comparable: boolean,
): SourcePackageValueMutation {
  const previous = previousValue == null ? null : Number(previousValue);
  const next = nextValue == null ? null : Number(nextValue);
  if (!comparable) {
    return {
      previousValue: previous,
      nextValue: next,
      absoluteDifference: null,
      relativeMutationPercentage: null,
      direction: 'niet_bepaalbaar',
      comparability: 'niet_direct_vergelijkbaar',
    };
  }
  if (previous == null || next == null || !Number.isFinite(previous) || !Number.isFinite(next)) {
    return {
      previousValue: previous,
      nextValue: next,
      absoluteDifference: null,
      relativeMutationPercentage: null,
      direction: 'niet_bepaalbaar',
      comparability: 'niet_van_toepassing',
    };
  }
  const absoluteDifference = next - previous;
  const relativeMutationPercentage = previous === 0 ? null : (absoluteDifference / Math.abs(previous)) * 100;
  return {
    previousValue: previous,
    nextValue: next,
    absoluteDifference,
    relativeMutationPercentage,
    direction: absoluteDifference > 0 ? 'stijging' : absoluteDifference < 0 ? 'daling' : 'gelijk',
    comparability: 'direct_vergelijkbaar',
  };
}

function classificationSnapshot(entry: VastgoedrekenenKengetal): Record<string, string[]> {
  return Object.fromEntries(CLASSIFICATION_KEYS.map((key) => [key, stableArray(entry[key])])) as Record<string, string[]>;
}

function scopeSnapshot(entry: VastgoedrekenenKengetal): Record<string, string[]> {
  return {
    toepassingsgebied: stableArray(entry.toepassingsgebied),
    regio: stableArray(entry.regio),
    projectfase: stableArray(entry.projectfase),
    risicoklasse: stableArray(entry.risicoklasse),
  };
}

function warningForMutation(
  code: string,
  field: SourcePackageComparedField,
  mutation: SourcePackageValueMutation,
  config: SourcePackageComparisonConfig,
): SourcePackageComparisonWarning[] {
  const percentage = mutation.relativeMutationPercentage;
  if (percentage == null) return [];
  const absolute = Math.abs(percentage);
  if (absolute >= config.criticalPercentage) {
    return [{ code: 'critical_mutation', severity: 'kritiek', entryCode: code, field, message: `${field} wijzigt met ${percentage.toFixed(1)}%.` }];
  }
  if (absolute >= config.warningPercentage) {
    return [{ code: 'large_mutation', severity: 'waarschuwing', entryCode: code, field, message: `${field} wijzigt met ${percentage.toFixed(1)}%.` }];
  }
  return [];
}

function compareMatchedEntry(
  previous: VastgoedrekenenKengetal,
  next: VastgoedrekenenKengetal,
  config: SourcePackageComparisonConfig,
): SourcePackageEntryComparison {
  const changes: SourcePackageFieldChange[] = [];
  const warnings: SourcePackageComparisonWarning[] = [];
  const unitChanged = (previous.unit_code ?? previous.eenheid) !== (next.unit_code ?? next.eenheid);

  (['minimum_waarde', 'basis_waarde', 'maximum_waarde'] as const).forEach((field) => {
    if (Number(previous[field]) === Number(next[field])) return;
    const mutation = numericMutation(previous[field], next[field], !unitChanged);
    changes.push({ field, previousValue: previous[field], nextValue: next[field], mutation });
    warnings.push(...warningForMutation(previous.code, field, mutation, config));
    if (mutation.comparability === 'niet_direct_vergelijkbaar') {
      warnings.push({ code: 'not_directly_comparable', severity: 'waarschuwing', entryCode: previous.code, field, message: `${field} is door de gewijzigde eenheid niet direct vergelijkbaar.` });
    }
  });

  const scalarFields: Array<[SourcePackageComparedField, unknown, unknown]> = [
    ['unit_code', previous.unit_code ?? previous.eenheid, next.unit_code ?? next.eenheid],
    ['vat_treatment_code', previous.vat_treatment_code, next.vat_treatment_code],
    ['categorie', previous.categorie, next.categorie],
    ['scenario_veld', previous.scenario_veld, next.scenario_veld],
    ['prijspeildatum', previous.bron_peildatum, next.bron_peildatum],
  ];
  scalarFields.forEach(([field, previousValue, nextValue]) => {
    if (!sameValue(previousValue, nextValue)) changes.push({ field, previousValue, nextValue });
  });

  const previousClassification = classificationSnapshot(previous);
  const nextClassification = classificationSnapshot(next);
  if (!sameValue(previousClassification, nextClassification)) {
    changes.push({ field: 'classificatie', previousValue: previousClassification, nextValue: nextClassification });
  }
  const previousScope = scopeSnapshot(previous);
  const nextScope = scopeSnapshot(next);
  if (!sameValue(previousScope, nextScope)) changes.push({ field: 'scope', previousValue: previousScope, nextValue: nextScope });

  if (unitChanged) warnings.push({ code: 'unit_changed', severity: 'kritiek', entryCode: previous.code, field: 'unit_code', message: 'De eenheid is gewijzigd; financiële waarden zijn niet automatisch vergelijkbaar.' });
  if (previous.vat_treatment_code !== next.vat_treatment_code) warnings.push({ code: 'vat_treatment_changed', severity: 'kritiek', entryCode: previous.code, field: 'vat_treatment_code', message: 'De btw-behandeling is gewijzigd.' });
  if (previous.bron_peildatum !== next.bron_peildatum) warnings.push({ code: 'price_level_changed', severity: 'waarschuwing', entryCode: previous.code, field: 'prijspeildatum', message: 'De bron- of prijspeildatum is gewijzigd.' });
  if (!sameValue(previousClassification, nextClassification)) warnings.push({ code: 'classification_changed', severity: 'waarschuwing', entryCode: previous.code, field: 'classificatie', message: 'De gecontroleerde classificatie is gewijzigd.' });
  if (!sameValue(previousScope, nextScope)) warnings.push({ code: 'scope_changed', severity: 'waarschuwing', entryCode: previous.code, field: 'scope', message: 'De toepassingsscope is gewijzigd.' });

  return {
    code: previous.code,
    name: next.naam,
    changeType: changes.length > 0 ? 'gewijzigd' : 'ongewijzigd',
    previousEntry: previous,
    nextEntry: next,
    fieldChanges: changes,
    warnings,
  };
}

function summarize(
  previousPackage: VastgoedrekenenSourcePackage,
  nextPackage: VastgoedrekenenSourcePackage,
  entries: readonly SourcePackageEntryComparison[],
): SourcePackageComparisonSummary {
  const percentages = entries.flatMap((entry) => entry.fieldChanges.map((change) => change.mutation?.relativeMutationPercentage).filter((value): value is number => value != null));
  const warnings = entries.flatMap((entry) => entry.warnings);
  return {
    previousCodeCount: entries.filter((entry) => entry.previousEntry).length,
    nextCodeCount: entries.filter((entry) => entry.nextEntry).length,
    addedCount: entries.filter((entry) => entry.changeType === 'toegevoegd').length,
    removedCount: entries.filter((entry) => entry.changeType === 'vervallen').length,
    changedCount: entries.filter((entry) => entry.changeType === 'gewijzigd').length,
    unchangedCount: entries.filter((entry) => entry.changeType === 'ongewijzigd').length,
    warningCount: warnings.length,
    criticalWarningCount: warnings.filter((warning) => warning.severity === 'kritiek').length,
    largestIncreasePercentage: percentages.filter((value) => value > 0).sort((a, b) => b - a)[0] ?? null,
    largestDecreasePercentage: percentages.filter((value) => value < 0).sort((a, b) => a - b)[0] ?? null,
    previousPriceLevelDate: previousPackage.prijspeildatum,
    nextPriceLevelDate: nextPackage.prijspeildatum,
  };
}

export function compareSourcePackageVersions(args: {
  previousPackage: VastgoedrekenenSourcePackage;
  nextPackage: VastgoedrekenenSourcePackage;
  previousEntries: readonly VastgoedrekenenKengetal[];
  nextEntries: readonly VastgoedrekenenKengetal[];
  config?: SourcePackageComparisonConfig;
  calculatedAt?: string;
}): SourcePackageVersionComparison {
  const { previousPackage, nextPackage, previousEntries, nextEntries } = args;
  const config = args.config ?? DEFAULT_SOURCE_PACKAGE_COMPARISON_CONFIG;
  if (previousPackage.code !== nextPackage.code) throw new Error('Alleen versies met dezelfde bronpakketcode kunnen worden vergeleken.');
  if (previousPackage.id === nextPackage.id) throw new Error('Selecteer twee verschillende bronpakketversies.');
  if (nextPackage.versie <= previousPackage.versie) throw new Error('De nieuwe bronpakketversie moet hoger zijn dan de vorige versie.');
  if (config.warningPercentage < 0 || config.criticalPercentage <= config.warningPercentage) throw new Error('Ongeldige mutatiedrempels.');

  const previousByCode = new Map(previousEntries.map((entry) => [entry.code, entry]));
  const nextByCode = new Map(nextEntries.map((entry) => [entry.code, entry]));
  const codes = [...new Set([...previousByCode.keys(), ...nextByCode.keys()])].sort((a, b) => a.localeCompare(b));
  const entries = codes.map((code): SourcePackageEntryComparison => {
    const previous = previousByCode.get(code) ?? null;
    const next = nextByCode.get(code) ?? null;
    if (!previous && next) return { code, name: next.naam, changeType: 'toegevoegd', previousEntry: null, nextEntry: next, fieldChanges: [], warnings: [] };
    if (previous && !next) return { code, name: previous.naam, changeType: 'vervallen', previousEntry: previous, nextEntry: null, fieldChanges: [], warnings: [] };
    return compareMatchedEntry(previous!, next!, config);
  });
  const warnings = entries.flatMap((entry) => entry.warnings);
  return {
    packageCode: previousPackage.code,
    previousPackageId: previousPackage.id,
    nextPackageId: nextPackage.id,
    previousVersion: previousPackage.versie,
    nextVersion: nextPackage.versie,
    status: 'concept',
    entries,
    warnings,
    summary: summarize(previousPackage, nextPackage, entries),
    calculatedAt: args.calculatedAt ?? new Date().toISOString(),
    algorithmVersion: SOURCE_PACKAGE_COMPARISON_ALGORITHM_VERSION,
  };
}

export function canApproveSourcePackageComparison(args: {
  status: SourcePackageComparisonStatus;
  comparison: SourcePackageVersionComparison;
  criticalWarningsAcknowledged: boolean;
}): boolean {
  return args.status === 'te_beoordelen'
    && (args.comparison.summary.criticalWarningCount === 0 || args.criticalWarningsAcknowledged);
}
