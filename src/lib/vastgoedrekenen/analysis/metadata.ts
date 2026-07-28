export const ANALYSIS_QUESTION_MAX_LENGTH = 2_000;
export const ANALYSIS_TIME_HORIZON_MAX_MONTHS = 1_200;

export interface PersistedAnalysisMetadataColumns {
  analysis_question?: unknown;
  valuation_date?: unknown;
  time_horizon_months?: unknown;
}

export interface AnalysisMetadataInput {
  analysisQuestion?: unknown;
  valuationDate?: unknown;
  timeHorizonMonths?: unknown;
}

export interface AnalysisMetadataPersistencePatch {
  analysis_question?: string | null;
  valuation_date?: string | null;
  time_horizon_months?: number | null;
}

export interface ResolvedAnalysisMetadata {
  analysisQuestion: string | null;
  valuationDate: string | null;
  timeHorizonMonths: number | null;
  warnings: string[];
}

export class AnalysisMetadataValidationError extends Error {
  readonly field: keyof AnalysisMetadataInput;

  constructor(field: keyof AnalysisMetadataInput, message: string) {
    super(message);
    this.name = 'AnalysisMetadataValidationError';
    this.field = field;
  }
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function normalizeQuestion(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AnalysisMetadataValidationError('analysisQuestion', 'De analysevraag moet tekst of null zijn.');
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > ANALYSIS_QUESTION_MAX_LENGTH) {
    throw new AnalysisMetadataValidationError(
      'analysisQuestion',
      `De analysevraag mag maximaal ${ANALYSIS_QUESTION_MAX_LENGTH} tekens bevatten.`,
    );
  }
  return normalized;
}

function normalizeValuationDate(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !isIsoDate(value)) {
    throw new AnalysisMetadataValidationError('valuationDate', 'De peildatum moet een geldige datum in YYYY-MM-DD-formaat zijn.');
  }
  return value;
}

function normalizeTimeHorizon(value: unknown): number | null {
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > ANALYSIS_TIME_HORIZON_MAX_MONTHS) {
    throw new AnalysisMetadataValidationError(
      'timeHorizonMonths',
      `De tijdshorizon moet een geheel aantal maanden tussen 1 en ${ANALYSIS_TIME_HORIZON_MAX_MONTHS} zijn.`,
    );
  }
  return parsed;
}

/**
 * Maakt een metadata-only patch. `undefined` blijft onaangeraakt; null of lege tekst
 * is een expliciete leegmaakactie. Er worden geen scenario- of rekenvelden toegevoegd.
 */
export function analysisMetadataPersistencePatch(
  input: AnalysisMetadataInput,
): AnalysisMetadataPersistencePatch {
  const patch: AnalysisMetadataPersistencePatch = {};
  if (input.analysisQuestion !== undefined) {
    patch.analysis_question = normalizeQuestion(input.analysisQuestion);
  }
  if (input.valuationDate !== undefined) {
    patch.valuation_date = normalizeValuationDate(input.valuationDate);
  }
  if (input.timeHorizonMonths !== undefined) {
    patch.time_horizon_months = normalizeTimeHorizon(input.timeHorizonMonths);
  }
  return patch;
}

/** Read-only normalisatie voor records uit een oud, nieuw of gedeeltelijk schema. */
export function resolveAnalysisMetadata(
  record: PersistedAnalysisMetadataColumns,
): ResolvedAnalysisMetadata {
  const warnings: string[] = [];

  let analysisQuestion: string | null = null;
  if (record.analysis_question !== null && record.analysis_question !== undefined && record.analysis_question !== '') {
    if (typeof record.analysis_question === 'string') {
      const normalized = record.analysis_question.trim();
      if (normalized.length <= ANALYSIS_QUESTION_MAX_LENGTH) analysisQuestion = normalized || null;
      else warnings.push('De opgeslagen analysevraag is langer dan toegestaan en is niet overgenomen.');
    } else {
      warnings.push('De opgeslagen analysevraag heeft een ongeldig type en is niet overgenomen.');
    }
  }

  let valuationDate: string | null = null;
  if (record.valuation_date !== null && record.valuation_date !== undefined && record.valuation_date !== '') {
    if (typeof record.valuation_date === 'string' && isIsoDate(record.valuation_date)) valuationDate = record.valuation_date;
    else warnings.push('De opgeslagen peildatum is ongeldig en is niet overgenomen.');
  }

  let timeHorizonMonths: number | null = null;
  if (record.time_horizon_months !== null && record.time_horizon_months !== undefined && record.time_horizon_months !== '') {
    const parsed = typeof record.time_horizon_months === 'number'
      ? record.time_horizon_months
      : Number(record.time_horizon_months);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= ANALYSIS_TIME_HORIZON_MAX_MONTHS) {
      timeHorizonMonths = parsed;
    } else {
      warnings.push('De opgeslagen tijdshorizon is ongeldig en is niet overgenomen.');
    }
  }

  return { analysisQuestion, valuationDate, timeHorizonMonths, warnings };
}
