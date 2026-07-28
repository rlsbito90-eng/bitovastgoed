// Canoniek allocatie- en timingcontract voor componentstrategie-units.
//
// Fase 4A is bewust read-only ten opzichte van de bestaande rekenkern:
// - bestaande rijen zonder nieuwe velden blijven als 100% allocatie leesbaar;
// - timing beïnvloedt nog geen scenariowaarde, DCF of financiering;
// - helpers schrijven alleen expliciete, gevalideerde patches terug.

export const COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION = 1 as const;
export const MAX_COMPONENT_TIMING_MONTH = 1200;

const SALE_STRATEGIES = new Set([
  'verkopen_leeg',
  'verkopen_verhuurd',
  'renoveren_verkopen',
  'splitsen_verkopen',
  'transformeren_verkopen',
  'sloop_nieuwbouw_verkopen',
]);

const HOLD_STRATEGIES = new Set([
  'aanhouden',
  'renoveren_aanhouden',
  'transformeren_aanhouden',
  'sloop_nieuwbouw_aanhouden',
]);

const DEVELOPMENT_STRATEGIES = new Set([
  'renoveren_verkopen',
  'renoveren_aanhouden',
  'splitsen_verkopen',
  'transformeren_verkopen',
  'transformeren_aanhouden',
  'sloop_nieuwbouw_verkopen',
  'sloop_nieuwbouw_aanhouden',
]);

export type ComponentTimingEventType =
  | 'development_start'
  | 'development_end'
  | 'rent_start'
  | 'sale_receipt'
  | 'terminal_exit';

export type ComponentAllocationTimingRecord = {
  id: string;
  component_id?: string | null;
  unit_label?: string | null;
  unit_name?: string | null;
  strategy?: string | null;
  allocation_percentage?: number | string | null;
  development_start_month?: number | string | null;
  development_end_month?: number | string | null;
  rent_start_month?: number | string | null;
  expected_sale_period_months?: number | string | null;
  hold_exit_month?: number | string | null;
  allocation_timing_schema_version?: number | string | null;
  [key: string]: unknown;
};

export type ResolvedComponentAllocationTiming = {
  unitId: string;
  componentKey: string;
  label: string;
  strategy: string | null;
  allocationPercentage: number;
  allocationSource: 'canonical' | 'legacy_default';
  developmentStartMonth: number | null;
  developmentEndMonth: number | null;
  rentStartMonth: number | null;
  saleReceiptMonth: number | null;
  terminalExitMonth: number | null;
  schemaVersion: number | null;
  events: ComponentTimingEvent[];
  completeForStrategy: boolean;
  warnings: string[];
};

export type ComponentTimingEvent = {
  unitId: string;
  componentKey: string;
  label: string;
  type: ComponentTimingEventType;
  month: number;
  allocationPercentage: number;
};

export type ComponentAllocationGroup = {
  componentKey: string;
  unitIds: string[];
  labels: string[];
  totalAllocationPercentage: number;
  status: 'complete' | 'underallocated' | 'overallocated';
  remainderPercentage: number;
};

export type ComponentAllocationTimingAnalysis = {
  readyForPeriodicCashflow: boolean;
  units: ResolvedComponentAllocationTiming[];
  groups: ComponentAllocationGroup[];
  events: ComponentTimingEvent[];
  warnings: string[];
};

export type ComponentAllocationTimingPatch = {
  allocation_percentage: number;
  development_start_month: number | null;
  development_end_month: number | null;
  rent_start_month: number | null;
  expected_sale_period_months: number | null;
  hold_exit_month: number | null;
  allocation_timing_schema_version: typeof COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION;
};

export class ComponentAllocationTimingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentAllocationTimingValidationError';
  }
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerMonth(value: unknown, fieldLabel: string): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_COMPONENT_TIMING_MONTH) {
    throw new ComponentAllocationTimingValidationError(
      `${fieldLabel} moet een geheel aantal maanden tussen 0 en ${MAX_COMPONENT_TIMING_MONTH} zijn.`,
    );
  }
  return parsed;
}

function allocationPercentage(value: unknown): number {
  const parsed = finiteNumber(value);
  if (parsed === null) return 100;
  if (parsed <= 0 || parsed > 100) {
    throw new ComponentAllocationTimingValidationError('Allocatiepercentage moet groter dan 0 en maximaal 100 zijn.');
  }
  return Number(parsed.toFixed(4));
}

function labelFor(record: ComponentAllocationTimingRecord): string {
  return record.unit_label?.trim() || record.unit_name?.trim() || 'Unit';
}

function componentKeyFor(record: ComponentAllocationTimingRecord): string {
  return record.component_id?.trim() || `unit:${record.id}`;
}

function isSaleStrategy(strategy: string | null): boolean {
  return strategy !== null && SALE_STRATEGIES.has(strategy);
}

function isHoldStrategy(strategy: string | null): boolean {
  return strategy !== null && HOLD_STRATEGIES.has(strategy);
}

function isDevelopmentStrategy(strategy: string | null): boolean {
  return strategy !== null && DEVELOPMENT_STRATEGIES.has(strategy);
}

function validateOrder(
  earlier: number | null,
  later: number | null,
  message: string,
): void {
  if (earlier !== null && later !== null && later < earlier) {
    throw new ComponentAllocationTimingValidationError(message);
  }
}

export function componentAllocationTimingPatch(input: {
  allocationPercentage?: unknown;
  developmentStartMonth?: unknown;
  developmentEndMonth?: unknown;
  rentStartMonth?: unknown;
  saleReceiptMonth?: unknown;
  terminalExitMonth?: unknown;
}): ComponentAllocationTimingPatch {
  const allocation = allocationPercentage(input.allocationPercentage);
  const developmentStart = integerMonth(input.developmentStartMonth, 'Ontwikkelstart');
  const developmentEnd = integerMonth(input.developmentEndMonth, 'Ontwikkel-einde');
  const rentStart = integerMonth(input.rentStartMonth, 'Huurstart');
  const saleReceipt = integerMonth(input.saleReceiptMonth, 'Verkoopmaand');
  const terminalExit = integerMonth(input.terminalExitMonth, 'Terminale exitmaand');

  validateOrder(developmentStart, developmentEnd, 'Ontwikkel-einde kan niet vóór de ontwikkelstart liggen.');
  validateOrder(developmentEnd, rentStart, 'Huurstart kan niet vóór het ontwikkel-einde liggen.');
  validateOrder(developmentEnd, saleReceipt, 'Verkoopmaand kan niet vóór het ontwikkel-einde liggen.');
  validateOrder(rentStart, terminalExit, 'Terminale exit kan niet vóór de huurstart liggen.');

  return {
    allocation_percentage: allocation,
    development_start_month: developmentStart,
    development_end_month: developmentEnd,
    rent_start_month: rentStart,
    expected_sale_period_months: saleReceipt,
    hold_exit_month: terminalExit,
    allocation_timing_schema_version: COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION,
  };
}

export function resolveComponentAllocationTiming(
  record: ComponentAllocationTimingRecord,
  timeHorizonMonths?: number | null,
): ResolvedComponentAllocationTiming {
  const label = labelFor(record);
  const strategy = typeof record.strategy === 'string' && record.strategy.trim()
    ? record.strategy
    : null;
  const warnings: string[] = [];

  let allocation = 100;
  let allocationSource: ResolvedComponentAllocationTiming['allocationSource'] = 'legacy_default';
  try {
    const rawAllocation = finiteNumber(record.allocation_percentage);
    allocation = allocationPercentage(record.allocation_percentage);
    allocationSource = rawAllocation === null ? 'legacy_default' : 'canonical';
  } catch (error) {
    allocation = 100;
    warnings.push(error instanceof Error ? error.message : `${label}: ongeldig allocatiepercentage.`);
  }

  const safeMonth = (value: unknown, fieldLabel: string): number | null => {
    try {
      return integerMonth(value, fieldLabel);
    } catch (error) {
      warnings.push(error instanceof Error ? `${label}: ${error.message}` : `${label}: ongeldige timing.`);
      return null;
    }
  };

  const developmentStartMonth = safeMonth(record.development_start_month, 'Ontwikkelstart');
  const developmentEndMonth = safeMonth(record.development_end_month, 'Ontwikkel-einde');
  const rentStartMonth = safeMonth(record.rent_start_month, 'Huurstart');
  const saleReceiptMonth = safeMonth(record.expected_sale_period_months, 'Verkoopmaand');
  const terminalExitMonth = safeMonth(record.hold_exit_month, 'Terminale exitmaand');
  const schemaVersionRaw = finiteNumber(record.allocation_timing_schema_version);
  const schemaVersion = schemaVersionRaw !== null && Number.isInteger(schemaVersionRaw) && schemaVersionRaw > 0
    ? schemaVersionRaw
    : null;

  if (developmentStartMonth !== null && developmentEndMonth !== null && developmentEndMonth < developmentStartMonth) {
    warnings.push(`${label}: ontwikkel-einde ligt vóór de ontwikkelstart.`);
  }
  if (developmentEndMonth !== null && rentStartMonth !== null && rentStartMonth < developmentEndMonth) {
    warnings.push(`${label}: huurstart ligt vóór het ontwikkel-einde.`);
  }
  if (developmentEndMonth !== null && saleReceiptMonth !== null && saleReceiptMonth < developmentEndMonth) {
    warnings.push(`${label}: verkoopmaand ligt vóór het ontwikkel-einde.`);
  }
  if (rentStartMonth !== null && terminalExitMonth !== null && terminalExitMonth < rentStartMonth) {
    warnings.push(`${label}: terminale exit ligt vóór de huurstart.`);
  }

  const horizon = finiteNumber(timeHorizonMonths);
  if (horizon !== null && horizon > 0) {
    const afterHorizon: Array<[string, number | null]> = [
      ['ontwikkel-einde', developmentEndMonth],
      ['huurstart', rentStartMonth],
      ['verkoop', saleReceiptMonth],
      ['terminale exit', terminalExitMonth],
    ];
    for (const [eventLabel, month] of afterHorizon) {
      if (month !== null && month > horizon) {
        warnings.push(`${label}: ${eventLabel} in maand ${month} valt buiten de Quickscan-horizon van ${horizon} maanden.`);
      }
    }
  }

  if (isDevelopmentStrategy(strategy)) {
    if (developmentStartMonth === null) warnings.push(`${label}: ontwikkelstart ontbreekt.`);
    if (developmentEndMonth === null) warnings.push(`${label}: ontwikkel-einde ontbreekt.`);
  }
  if (isSaleStrategy(strategy) && saleReceiptMonth === null) {
    warnings.push(`${label}: verkoopmaand ontbreekt.`);
  }
  if (isHoldStrategy(strategy) && rentStartMonth === null) {
    warnings.push(`${label}: huurstart ontbreekt.`);
  }

  const events: ComponentTimingEvent[] = [];
  const pushEvent = (type: ComponentTimingEventType, month: number | null) => {
    if (month === null) return;
    events.push({
      unitId: record.id,
      componentKey: componentKeyFor(record),
      label,
      type,
      month,
      allocationPercentage: allocation,
    });
  };
  pushEvent('development_start', developmentStartMonth);
  pushEvent('development_end', developmentEndMonth);
  pushEvent('rent_start', rentStartMonth);
  pushEvent('sale_receipt', saleReceiptMonth);
  pushEvent('terminal_exit', terminalExitMonth);

  const completeForStrategy = (
    (!isDevelopmentStrategy(strategy) || (developmentStartMonth !== null && developmentEndMonth !== null))
    && (!isSaleStrategy(strategy) || saleReceiptMonth !== null)
    && (!isHoldStrategy(strategy) || rentStartMonth !== null)
    && warnings.every((warning) => !warning.includes('ligt vóór'))
  );

  return {
    unitId: record.id,
    componentKey: componentKeyFor(record),
    label,
    strategy,
    allocationPercentage: allocation,
    allocationSource,
    developmentStartMonth,
    developmentEndMonth,
    rentStartMonth,
    saleReceiptMonth,
    terminalExitMonth,
    schemaVersion,
    events,
    completeForStrategy,
    warnings,
  };
}

export function analyzeComponentAllocationTiming(
  records: ComponentAllocationTimingRecord[],
  timeHorizonMonths?: number | null,
): ComponentAllocationTimingAnalysis {
  const units = records.map((record) => resolveComponentAllocationTiming(record, timeHorizonMonths));
  const grouped = new Map<string, ResolvedComponentAllocationTiming[]>();
  for (const unit of units) {
    const current = grouped.get(unit.componentKey) ?? [];
    current.push(unit);
    grouped.set(unit.componentKey, current);
  }

  const groups: ComponentAllocationGroup[] = [];
  const warnings: string[] = units.flatMap((unit) => unit.warnings);
  for (const [componentKey, groupedUnits] of grouped) {
    const total = Number(groupedUnits.reduce((sum, unit) => sum + unit.allocationPercentage, 0).toFixed(4));
    const status: ComponentAllocationGroup['status'] = total > 100.0001
      ? 'overallocated'
      : total < 99.9999
        ? 'underallocated'
        : 'complete';
    const remainder = Number((100 - total).toFixed(4));
    groups.push({
      componentKey,
      unitIds: groupedUnits.map((unit) => unit.unitId),
      labels: groupedUnits.map((unit) => unit.label),
      totalAllocationPercentage: total,
      status,
      remainderPercentage: remainder,
    });

    if (status === 'overallocated') {
      warnings.push(`${groupedUnits[0]?.label ?? componentKey}: allocaties tellen op tot ${total}% en overschrijden 100%.`);
    }
    if (status === 'underallocated' && groupedUnits.length > 1) {
      warnings.push(`${groupedUnits[0]?.label ?? componentKey}: ${remainder}% van het gekoppelde component is nog niet toegewezen.`);
    }
  }

  const events = units
    .flatMap((unit) => unit.events)
    .sort((left, right) => left.month - right.month || left.label.localeCompare(right.label, 'nl'));
  const allocationReady = groups.every((group) => group.status === 'complete');
  const timingReady = units.every((unit) => unit.completeForStrategy);

  return {
    readyForPeriodicCashflow: records.length > 0 && allocationReady && timingReady,
    units,
    groups,
    events,
    warnings,
  };
}

const CLONE_OMIT_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'net_sale_proceeds',
  'hold_value_calculated',
  'contribution_to_scenario_value',
]);

export function buildComponentAllocationSplit(
  record: ComponentAllocationTimingRecord,
): {
  currentPatch: Pick<ComponentAllocationTimingPatch, 'allocation_percentage' | 'allocation_timing_schema_version'>;
  clonePatch: Record<string, unknown>;
} {
  const resolved = resolveComponentAllocationTiming(record);
  if (resolved.allocationPercentage <= 0.0001) {
    throw new ComponentAllocationTimingValidationError('Deze allocatie kan niet verder worden gesplitst.');
  }

  const firstShare = Number((resolved.allocationPercentage / 2).toFixed(4));
  const secondShare = Number((resolved.allocationPercentage - firstShare).toFixed(4));
  if (firstShare <= 0 || secondShare <= 0) {
    throw new ComponentAllocationTimingValidationError('Deze allocatie is te klein om veilig te splitsen.');
  }

  const clonePatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (CLONE_OMIT_FIELDS.has(key)) continue;
    clonePatch[key] = value;
  }
  clonePatch.unit_label = `${labelFor(record)} — deel 2`;
  clonePatch.allocation_percentage = secondShare;
  clonePatch.allocation_timing_schema_version = COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION;

  return {
    currentPatch: {
      allocation_percentage: firstShare,
      allocation_timing_schema_version: COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION,
    },
    clonePatch,
  };
}
