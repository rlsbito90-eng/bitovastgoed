import type { ScenarioCost } from './types';

export const SCENARIO_COST_CASHFLOW_SCHEMA_VERSION = 1 as const;
export const MAX_SCENARIO_COST_CASHFLOW_MONTH = 1200;

export type ScenarioCostCashflowTimingMethod = 'single' | 'linear';

export type ScenarioCostCashflowTimingRecord = {
  id: string;
  cost_category?: string | null;
  description?: string | null;
  amount?: number | null;
  cashflow_timing_method?: string | null;
  cashflow_start_month?: number | null;
  cashflow_end_month?: number | null;
  cashflow_payment_month?: number | null;
  cashflow_timing_schema_version?: number | null;
};

export type ResolvedScenarioCostCashflowTiming = {
  costId: string;
  label: string;
  method: ScenarioCostCashflowTimingMethod | null;
  startMonth: number | null;
  endMonth: number | null;
  paymentMonth: number | null;
  schemaVersion: number | null;
  explicit: boolean;
  valid: boolean;
  warnings: string[];
};

export type ScenarioCostCashflowTimingInput = {
  method: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
  paymentMonth?: unknown;
};

function raw(cost: ScenarioCost | ScenarioCostCashflowTimingRecord): Record<string, unknown> {
  return cost as unknown as Record<string, unknown>;
}

function labelFor(cost: ScenarioCost | ScenarioCostCashflowTimingRecord): string {
  const record = raw(cost);
  const description = String(record.description ?? '').trim();
  const category = String(record.cost_category ?? '').trim();
  return description || category || 'Naamloze kostenpost';
}

function storedInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function optionalInteger(value: unknown, fieldLabel: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${fieldLabel} moet een geheel aantal maanden zijn.`);
  if (parsed < 0 || parsed > MAX_SCENARIO_COST_CASHFLOW_MONTH) {
    throw new Error(`${fieldLabel} moet tussen 0 en ${MAX_SCENARIO_COST_CASHFLOW_MONTH} liggen.`);
  }
  return parsed;
}

export function resolveScenarioCostCashflowTiming(
  cost: ScenarioCost | ScenarioCostCashflowTimingRecord,
  timeHorizonMonths?: number | null,
): ResolvedScenarioCostCashflowTiming {
  const record = raw(cost);
  const label = labelFor(cost);
  const methodRaw = record.cashflow_timing_method;
  const method: ScenarioCostCashflowTimingMethod | null = methodRaw === 'single' || methodRaw === 'linear'
    ? methodRaw
    : null;
  const startMonth = storedInteger(record.cashflow_start_month);
  const endMonth = storedInteger(record.cashflow_end_month);
  const paymentMonth = storedInteger(record.cashflow_payment_month);
  const schemaVersion = storedInteger(record.cashflow_timing_schema_version);
  const explicit = methodRaw !== null && methodRaw !== undefined && methodRaw !== ''
    || startMonth !== null
    || endMonth !== null
    || paymentMonth !== null
    || schemaVersion !== null;
  const warnings: string[] = [];

  if (!explicit) {
    warnings.push(`${label}: kasstroomtiming is nog niet vastgelegd.`);
  } else if (schemaVersion !== SCENARIO_COST_CASHFLOW_SCHEMA_VERSION) {
    warnings.push(`${label}: onbekende of ontbrekende timingschemaversie.`);
  }

  if (methodRaw != null && methodRaw !== '' && method === null) {
    warnings.push(`${label}: onbekende timingmethode.`);
  }

  if (method === 'single') {
    if (paymentMonth === null) warnings.push(`${label}: betaalmaand ontbreekt.`);
    if (startMonth !== null || endMonth !== null) {
      warnings.push(`${label}: een eenmalige betaling mag geen start- of eindmaand bevatten.`);
    }
  }

  if (method === 'linear') {
    if (startMonth === null || endMonth === null) {
      warnings.push(`${label}: start- en eindmaand zijn verplicht voor lineaire verdeling.`);
    } else if (endMonth < startMonth) {
      warnings.push(`${label}: eindmaand kan niet vóór de startmaand liggen.`);
    }
    if (paymentMonth !== null) warnings.push(`${label}: lineaire verdeling mag geen losse betaalmaand bevatten.`);
  }

  const horizon = Number(timeHorizonMonths ?? Number.NaN);
  if (Number.isInteger(horizon) && horizon > 0) {
    const months = [startMonth, endMonth, paymentMonth].filter((month): month is number => month !== null);
    if (months.some((month) => month > horizon)) {
      warnings.push(`${label}: timing valt buiten de Quickscan-horizon van ${horizon} maanden.`);
    }
  }

  return {
    costId: String(record.id ?? ''),
    label,
    method,
    startMonth,
    endMonth,
    paymentMonth,
    schemaVersion,
    explicit,
    valid: explicit && warnings.length === 0,
    warnings,
  };
}

export function scenarioCostCashflowTimingPatch(
  input: ScenarioCostCashflowTimingInput,
): Record<string, unknown> {
  if (input.method !== 'single' && input.method !== 'linear') {
    throw new Error('Kies een geldige timingmethode voor deze kostenpost.');
  }

  if (input.method === 'single') {
    const paymentMonth = optionalInteger(input.paymentMonth, 'Betaalmaand');
    if (paymentMonth === null) throw new Error('Vul een betaalmaand in.');
    return {
      cashflow_timing_method: 'single',
      cashflow_start_month: null,
      cashflow_end_month: null,
      cashflow_payment_month: paymentMonth,
      cashflow_timing_schema_version: SCENARIO_COST_CASHFLOW_SCHEMA_VERSION,
    };
  }

  const startMonth = optionalInteger(input.startMonth, 'Startmaand');
  const endMonth = optionalInteger(input.endMonth, 'Eindmaand');
  if (startMonth === null || endMonth === null) {
    throw new Error('Vul voor lineaire verdeling een start- en eindmaand in.');
  }
  if (endMonth < startMonth) throw new Error('Eindmaand kan niet vóór de startmaand liggen.');

  return {
    cashflow_timing_method: 'linear',
    cashflow_start_month: startMonth,
    cashflow_end_month: endMonth,
    cashflow_payment_month: null,
    cashflow_timing_schema_version: SCENARIO_COST_CASHFLOW_SCHEMA_VERSION,
  };
}

export function clearScenarioCostCashflowTimingPatch(): Record<string, null> {
  return {
    cashflow_timing_method: null,
    cashflow_start_month: null,
    cashflow_end_month: null,
    cashflow_payment_month: null,
    cashflow_timing_schema_version: null,
  };
}
