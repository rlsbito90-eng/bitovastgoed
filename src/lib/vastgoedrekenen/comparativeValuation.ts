export type ComparativePriceType = 'asking_price' | 'transaction_price' | 'valuation' | 'other';
export type ComparativeReliability = 'high' | 'medium' | 'low';
export type ComparativeMethod = 'median' | 'weighted_average';
export type ComparativeBasis = 'per_m2' | 'per_unit';

export interface ComparativeReferenceInput {
  id: string;
  included: boolean;
  price: number;
  areaM2?: number | null;
  unitPrice?: number | null;
  priceType: ComparativePriceType;
  transactionDate?: string | null;
  valuationDate?: string | null;
  sourceReference?: string | null;
  sourceReliability?: 'high' | 'medium' | 'low' | 'unknown' | null;
  weight?: number;
  adjustments?: {
    locationPct?: number;
    sizePct?: number;
    conditionPct?: number;
    energyPct?: number;
    occupancyPct?: number;
    otherPct?: number;
  };
}

export interface ComparativeValuationInput {
  subjectAreaM2: number;
  basis: ComparativeBasis;
  method: ComparativeMethod;
  valuationDate: string;
  references: ComparativeReferenceInput[];
}

export interface ComparativeIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  referenceId?: string;
}

export interface ComparativeAdjustedValue {
  referenceId: string;
  originalUnitValue: number;
  totalAdjustmentPct: number;
  adjustedUnitValue: number;
  weight: number;
}

export interface ComparativeValuationResult {
  valid: boolean;
  issues: ComparativeIssue[];
  includedReferenceCount: number;
  adjustedUnitValues: ComparativeAdjustedValue[];
  centralUnitValue: number | null;
  lowerUnitValue: number | null;
  upperUnitValue: number | null;
  indicatedTotalValue: number | null;
  lowerTotalValue: number | null;
  upperTotalValue: number | null;
  reliability: ComparativeReliability;
  explanation: string[];
}

const roundMoney = (value: number): number => Math.round(value);
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

function totalAdjustment(reference: ComparativeReferenceInput): number {
  const a = reference.adjustments ?? {};
  return (a.locationPct ?? 0)
    + (a.sizePct ?? 0)
    + (a.conditionPct ?? 0)
    + (a.energyPct ?? 0)
    + (a.occupancyPct ?? 0)
    + (a.otherPct ?? 0);
}

function originalUnitValue(reference: ComparativeReferenceInput, basis: ComparativeBasis): number | null {
  if (reference.unitPrice != null) return reference.unitPrice;
  if (basis === 'per_m2') {
    if (!reference.areaM2 || reference.areaM2 <= 0) return null;
    return reference.price / reference.areaM2;
  }
  return reference.price;
}

export function computeComparativeValuation(
  input: ComparativeValuationInput,
): ComparativeValuationResult {
  const issues: ComparativeIssue[] = [];
  const included = input.references.filter((reference) => reference.included);

  if (!Number.isFinite(input.subjectAreaM2) || input.subjectAreaM2 <= 0) {
    issues.push({ code: 'invalid_subject_area', message: 'Waarderingsoppervlak moet groter zijn dan nul.', severity: 'error' });
  }

  const adjustedUnitValues: ComparativeAdjustedValue[] = [];
  for (const reference of included) {
    if (!Number.isFinite(reference.price) || reference.price < 0) {
      issues.push({ code: 'invalid_price', message: 'Referentieprijs mag niet negatief zijn.', severity: 'error', referenceId: reference.id });
      continue;
    }

    const original = originalUnitValue(reference, input.basis);
    if (original == null || !Number.isFinite(original) || original < 0) {
      issues.push({ code: 'missing_unit_basis', message: 'Referentie mist een geldige oppervlakte of eenheidsprijs.', severity: 'error', referenceId: reference.id });
      continue;
    }

    const adjustmentPct = totalAdjustment(reference);
    if (Math.abs(adjustmentPct) > 25) {
      issues.push({ code: 'large_adjustment', message: `Grote handmatige correctie (${adjustmentPct}%).`, severity: 'warning', referenceId: reference.id });
    }
    if (!reference.sourceReference) {
      issues.push({ code: 'missing_source', message: 'Bronreferentie ontbreekt.', severity: 'warning', referenceId: reference.id });
    }
    if (!reference.transactionDate && !reference.valuationDate) {
      issues.push({ code: 'missing_date', message: 'Transactie- of waardepeildatum ontbreekt.', severity: 'warning', referenceId: reference.id });
    }

    adjustedUnitValues.push({
      referenceId: reference.id,
      originalUnitValue: original,
      totalAdjustmentPct: adjustmentPct,
      adjustedUnitValue: original * (1 + adjustmentPct / 100),
      weight: reference.weight && reference.weight > 0 ? reference.weight : 1,
    });
  }

  if (adjustedUnitValues.length < 2) {
    issues.push({ code: 'insufficient_references', message: 'Minimaal twee bruikbare referenties zijn vereist.', severity: 'error' });
  }

  const hasErrors = issues.some((issue) => issue.severity === 'error');
  let centralUnitValue: number | null = null;
  let lowerUnitValue: number | null = null;
  let upperUnitValue: number | null = null;

  if (!hasErrors) {
    const values = adjustedUnitValues.map((value) => value.adjustedUnitValue);
    lowerUnitValue = Math.min(...values);
    upperUnitValue = Math.max(...values);
    if (input.method === 'median') {
      centralUnitValue = median(values);
    } else {
      const totalWeight = adjustedUnitValues.reduce((sum, value) => sum + value.weight, 0);
      centralUnitValue = adjustedUnitValues.reduce((sum, value) => sum + value.adjustedUnitValue * value.weight, 0) / totalWeight;
    }
  }

  const askingOnly = included.length > 0 && included.every((reference) => reference.priceType === 'asking_price');
  const strongTransactions = included.filter((reference) =>
    reference.priceType === 'transaction_price'
    && reference.sourceReliability === 'high'
    && Boolean(reference.transactionDate)
    && Boolean(reference.sourceReference),
  ).length;

  let reliability: ComparativeReliability = 'low';
  if (!hasErrors && strongTransactions >= 3 && !issues.some((issue) => issue.code === 'large_adjustment')) {
    reliability = 'high';
  } else if (!hasErrors && adjustedUnitValues.length >= 2) {
    reliability = 'medium';
  }
  if (askingOnly && reliability === 'high') reliability = 'medium';

  const factor = input.basis === 'per_m2' ? input.subjectAreaM2 : 1;
  const explanation = [
    input.method === 'median' ? 'Hoofdwaarde is de mediaan van gecorrigeerde eenheidsprijzen.' : 'Hoofdwaarde is het gewogen gemiddelde van gecorrigeerde eenheidsprijzen.',
    'Onder- en bovengrens zijn minimum en maximum van de ingeschakelde gecorrigeerde referenties.',
    'De uitkomst is indicatief en geen taxatie.',
  ];

  return {
    valid: !hasErrors,
    issues,
    includedReferenceCount: adjustedUnitValues.length,
    adjustedUnitValues,
    centralUnitValue,
    lowerUnitValue,
    upperUnitValue,
    indicatedTotalValue: centralUnitValue == null ? null : roundMoney(centralUnitValue * factor),
    lowerTotalValue: lowerUnitValue == null ? null : roundMoney(lowerUnitValue * factor),
    upperTotalValue: upperUnitValue == null ? null : roundMoney(upperUnitValue * factor),
    reliability,
    explanation,
  };
}

export function comparativeExitScenarioPatch(result: ComparativeValuationResult, subjectAreaM2: number) {
  if (!result.valid || result.centralUnitValue == null) {
    throw new Error('Alleen een geldige comparatieve waardering kan worden toegepast.');
  }
  return {
    sale_price_source: 'per_m2' as const,
    sale_price_per_m2: result.centralUnitValue,
    sale_sellable_m2: subjectAreaM2,
  };
}
