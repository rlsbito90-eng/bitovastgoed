import type { SellOffUnit } from './types';
import {
  analyzeComponentAllocationTiming,
  type ComponentAllocationGroup,
  type ComponentAllocationTimingRecord,
} from './componentAllocationTiming';

export type EffectiveComponentAllocation = {
  unitId: string;
  componentKey: string;
  allocationPercentage: number;
  effectiveWeight: number;
  groupStatus: ComponentAllocationGroup['status'];
  weightingApplied: boolean;
};

export type ComponentAllocationWeightingResolution = {
  byUnitId: ReadonlyMap<string, EffectiveComponentAllocation>;
  units: EffectiveComponentAllocation[];
  groups: ComponentAllocationGroup[];
  warnings: string[];
  weightingApplied: boolean;
};

function asAllocationRecord(unit: SellOffUnit): ComponentAllocationTimingRecord {
  return unit as unknown as ComponentAllocationTimingRecord;
}

/**
 * Bepaalt uitsluitend de effectieve financiële weging per strategie-unit.
 *
 * Veiligheidscontract:
 * - complete groepen van exact 100% worden gewogen;
 * - legacyregels zonder percentage blijven effectief 100%;
 * - onder- en oververdeelde groepen blijven ongewogen, zodat een onvolledige
 *   invoer de bestaande scenariowaarde niet stilzwijgend halveert of verhoogt.
 */
export function resolveComponentAllocationWeighting(
  units: SellOffUnit[],
): ComponentAllocationWeightingResolution {
  const analysis = analyzeComponentAllocationTiming(units.map(asAllocationRecord));
  const groupByKey = new Map(analysis.groups.map((group) => [group.componentKey, group]));
  const warnings: string[] = [];

  for (const resolved of analysis.units) {
    warnings.push(
      ...resolved.warnings.filter((warning) => warning.toLowerCase().includes('allocatie')),
    );
  }

  for (const group of analysis.groups) {
    if (group.status === 'complete') continue;
    const label = group.labels[0] ?? group.componentKey;
    const statusLabel = group.status === 'underallocated' ? 'onderverdeeld' : 'oververdeeld';
    warnings.push(
      `${label}: allocatiegroep is ${statusLabel} (${group.totalAllocationPercentage}%). `
      + 'De bestaande ongewogen rekenwijze blijft actief totdat de groep exact 100% bedraagt.',
    );
  }

  const resolvedUnits = analysis.units.map<EffectiveComponentAllocation>((unit) => {
    const group = groupByKey.get(unit.componentKey);
    const groupStatus = group?.status ?? 'complete';
    const effectiveWeight = groupStatus === 'complete'
      ? Number((unit.allocationPercentage / 100).toFixed(6))
      : 1;
    const weightingApplied = groupStatus === 'complete'
      && (group?.unitIds.length ?? 1) > 1
      || effectiveWeight !== 1;

    return {
      unitId: unit.unitId,
      componentKey: unit.componentKey,
      allocationPercentage: unit.allocationPercentage,
      effectiveWeight,
      groupStatus,
      weightingApplied,
    };
  });

  return {
    byUnitId: new Map(resolvedUnits.map((unit) => [unit.unitId, unit])),
    units: resolvedUnits,
    groups: analysis.groups,
    warnings,
    weightingApplied: resolvedUnits.some((unit) => unit.weightingApplied),
  };
}
