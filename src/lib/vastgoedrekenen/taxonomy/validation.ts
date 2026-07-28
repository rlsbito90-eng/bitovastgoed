import type {
  CanonicalScenarioTaxonomy,
  ComponentTiming,
  TaxonomyIssue,
  TaxonomyValidationMode,
  TaxonomyValidationResult,
} from './types';

export function validateScenarioTaxonomy(
  taxonomy: CanonicalScenarioTaxonomy,
  mode: TaxonomyValidationMode = 'draft',
): TaxonomyValidationResult {
  const issues: TaxonomyIssue[] = [];

  if (taxonomy.intervention === 'expand' && taxonomy.expansionSubtype === null) {
    issues.push({
      code: 'expansion_subtype_missing',
      severity: mode === 'strict' ? 'error' : 'warning',
      path: 'expansionSubtype',
      message: 'Kies welk type uitbreiding wordt toegepast.',
    });
  }

  if (taxonomy.intervention !== 'expand' && taxonomy.expansionSubtype !== null) {
    issues.push({
      code: 'expansion_subtype_without_expansion',
      severity: 'error',
      path: 'expansionSubtype',
      message: 'Een uitbreidingstype is alleen toegestaan bij de ingreep “Uitbreiden”.',
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

export function validateComponentTiming(timing: ComponentTiming): TaxonomyValidationResult {
  const issues: TaxonomyIssue[] = [];

  if (!Number.isFinite(timing.startMonth) || timing.startMonth < 0) {
    issues.push({
      code: 'invalid_start_month',
      severity: 'error',
      path: 'startMonth',
      message: 'De startmaand moet een niet-negatief getal zijn.',
    });
  }

  if (!Number.isFinite(timing.durationMonths) || timing.durationMonths < 0) {
    issues.push({
      code: 'invalid_duration_months',
      severity: 'error',
      path: 'durationMonths',
      message: 'De looptijd moet een niet-negatief getal zijn.',
    });
  }

  if (timing.dispositionMonth !== null) {
    if (!Number.isFinite(timing.dispositionMonth) || timing.dispositionMonth < 0) {
      issues.push({
        code: 'invalid_disposition_month',
        severity: 'error',
        path: 'dispositionMonth',
        message: 'De exitmaand moet null of een niet-negatief getal zijn.',
      });
    } else if (Number.isFinite(timing.startMonth) && timing.dispositionMonth < timing.startMonth) {
      issues.push({
        code: 'disposition_before_start',
        severity: 'error',
        path: 'dispositionMonth',
        message: 'De exitmaand mag niet vóór de startmaand liggen.',
      });
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}
