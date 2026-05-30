import type { Scenario } from './types';

export const SCENARIO_CLEAR_GUARD_META = '__allowClearFields';

export type GuardedScenarioPatch = Partial<Scenario> & {
  [SCENARIO_CLEAR_GUARD_META]?: string[];
};

const PROTECTED_SCENARIO_FIELDS = new Set<keyof Scenario>([
  'asking_price',
  'purchase_price',
  'rent_source',
  'sale_strategy',
  'leading_valuation_track',
  'ovb_mode',
  'ovb_classification',
  'transfer_tax_percentage',
  'transfer_tax_amount',
  'buyer_fee_amount',
  'buyer_fee_percentage',
  'buyer_fee_method' as keyof Scenario,
  'notary_costs_method' as keyof Scenario,
  'notary_costs_profile' as keyof Scenario,
  'target_bar',
  'target_factor',
  'target_margin',
  'manual_zero_fields',
]);

export function stripUndefinedEntries<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const clean: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === SCENARIO_CLEAR_GUARD_META) continue;
    if (value !== undefined) clean[key as keyof T] = value as T[keyof T];
  }
  return clean;
}

function isEmptyWrite(value: unknown): boolean {
  return value === null || value === '';
}

function hadStoredValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function buildScenarioSavePatch(
  current: Scenario,
  baseline: Scenario,
  touchedFields: Iterable<keyof Scenario>,
): GuardedScenarioPatch {
  const patch: GuardedScenarioPatch = {};
  const allowClearFields: string[] = [];

  for (const field of touchedFields) {
    const next = current[field];
    const prev = baseline[field];
    if (next === undefined || Object.is(next, prev)) continue;
    (patch as Record<string, unknown>)[field as string] = next;
    if (isEmptyWrite(next) && hadStoredValue(prev)) allowClearFields.push(field as string);
  }

  if (allowClearFields.length > 0) patch[SCENARIO_CLEAR_GUARD_META] = allowClearFields;
  return patch;
}

export function guardScenarioUpdatePatch(
  patch: GuardedScenarioPatch,
  current?: Scenario | null,
  onBlocked?: (field: string) => void,
): { patch: Partial<Scenario>; blockedFields: string[] } {
  const allowClear = new Set(patch[SCENARIO_CLEAR_GUARD_META] ?? []);
  const clean = stripUndefinedEntries(patch as Record<string, unknown>) as Partial<Scenario>;
  const blockedFields: string[] = [];

  for (const [field, value] of Object.entries(clean) as [keyof Scenario, unknown][]) {
    if (!PROTECTED_SCENARIO_FIELDS.has(field)) continue;
    if (!isEmptyWrite(value)) continue;
    if (allowClear.has(field as string)) continue;
    if (current && !hadStoredValue(current[field])) continue;

    delete clean[field];
    blockedFields.push(field as string);
    onBlocked?.(field as string);
  }

  return { patch: clean, blockedFields };
}
