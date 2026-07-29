import type { Scenario } from './types';

export const SCENARIO_DCF_SCHEMA_VERSION = 1 as const;

export type ScenarioDcfRecord = {
  id?: string | null;
  dcf_discount_rate_pct?: number | string | null;
  dcf_discount_rate_source?: string | null;
  dcf_discount_rate_notes?: string | null;
  dcf_schema_version?: number | string | null;
};

export type ResolvedScenarioDcfSettings = {
  annualDiscountRatePct: number | null;
  source: string | null;
  notes: string | null;
  schemaVersion: number | null;
  explicit: boolean;
  valid: boolean;
  warnings: string[];
};

export type ScenarioDcfSettingsInput = {
  annualDiscountRatePct: unknown;
  source: unknown;
  notes?: unknown;
};

function raw(scenario: Scenario | ScenarioDcfRecord): Record<string, unknown> {
  return scenario as unknown as Record<string, unknown>;
}

function storedNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function storedInteger(value: unknown): number | null {
  const parsed = storedNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function cleanOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

export function resolveScenarioDcfSettings(
  scenario: Scenario | ScenarioDcfRecord,
): ResolvedScenarioDcfSettings {
  const record = raw(scenario);
  const annualDiscountRatePct = storedNumber(record.dcf_discount_rate_pct);
  const source = cleanOptionalText(record.dcf_discount_rate_source);
  const notes = cleanOptionalText(record.dcf_discount_rate_notes);
  const schemaVersion = storedInteger(record.dcf_schema_version);
  const explicit = record.dcf_discount_rate_pct !== null && record.dcf_discount_rate_pct !== undefined
    || record.dcf_discount_rate_source !== null && record.dcf_discount_rate_source !== undefined
    || record.dcf_discount_rate_notes !== null && record.dcf_discount_rate_notes !== undefined
    || record.dcf_schema_version !== null && record.dcf_schema_version !== undefined;
  const warnings: string[] = [];

  if (!explicit) {
    warnings.push('Leg eerst een jaarlijkse ongefinancierde disconteringsvoet en bron vast.');
  } else {
    if (schemaVersion !== SCENARIO_DCF_SCHEMA_VERSION) {
      warnings.push('Onbekende of ontbrekende DCF-schemaversie.');
    }
    if (annualDiscountRatePct === null) {
      warnings.push('De jaarlijkse disconteringsvoet ontbreekt of is ongeldig.');
    } else if (annualDiscountRatePct < 0 || annualDiscountRatePct > 100) {
      warnings.push('De jaarlijkse disconteringsvoet moet tussen 0% en 100% liggen.');
    }
    if (!source) warnings.push('Leg de bron of onderbouwing van de disconteringsvoet vast.');
  }

  return {
    annualDiscountRatePct,
    source,
    notes,
    schemaVersion,
    explicit,
    valid: explicit && warnings.length === 0,
    warnings,
  };
}

export function scenarioDcfSettingsPatch(input: ScenarioDcfSettingsInput): Record<string, unknown> {
  const annualDiscountRatePct = storedNumber(input.annualDiscountRatePct);
  if (annualDiscountRatePct === null) throw new Error('Vul een geldige jaarlijkse disconteringsvoet in.');
  if (annualDiscountRatePct < 0 || annualDiscountRatePct > 100) {
    throw new Error('De jaarlijkse disconteringsvoet moet tussen 0% en 100% liggen.');
  }

  const source = cleanOptionalText(input.source);
  if (!source) throw new Error('Vul de bron of onderbouwing van de disconteringsvoet in.');
  if (source.length > 250) throw new Error('De bron mag maximaal 250 tekens bevatten.');

  const notes = cleanOptionalText(input.notes);
  if (notes && notes.length > 2_000) throw new Error('De toelichting mag maximaal 2.000 tekens bevatten.');

  return {
    dcf_discount_rate_pct: Math.round(annualDiscountRatePct * 10_000) / 10_000,
    dcf_discount_rate_source: source,
    dcf_discount_rate_notes: notes,
    dcf_schema_version: SCENARIO_DCF_SCHEMA_VERSION,
  };
}

export function clearScenarioDcfSettingsPatch(): Record<string, null> {
  return {
    dcf_discount_rate_pct: null,
    dcf_discount_rate_source: null,
    dcf_discount_rate_notes: null,
    dcf_schema_version: null,
  };
}
