import { describe, expect, it } from 'vitest';
import {
  COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION,
  ComponentAllocationTimingValidationError,
  analyzeComponentAllocationTiming,
  buildComponentAllocationSplit,
  componentAllocationTimingPatch,
  resolveComponentAllocationTiming,
  type ComponentAllocationTimingRecord,
} from '@/lib/vastgoedrekenen/componentAllocationTiming';

function unit(overrides: Partial<ComponentAllocationTimingRecord> = {}): ComponentAllocationTimingRecord {
  return {
    id: 'unit-1',
    component_id: 'component-1',
    unit_label: 'Woning A',
    strategy: 'verkopen_leeg',
    ...overrides,
  };
}

describe('Vastgoedrekenen Fase 4A — componentallocatie en timing', () => {
  it('leest bestaande records zonder backfill conservatief als 100% allocatie', () => {
    const resolved = resolveComponentAllocationTiming(unit());

    expect(resolved.allocationPercentage).toBe(100);
    expect(resolved.allocationSource).toBe('legacy_default');
    expect(resolved.schemaVersion).toBeNull();
    expect(resolved.completeForStrategy).toBe(false);
    expect(resolved.warnings).toContain('Woning A: verkoopmaand ontbreekt.');
  });

  it('bouwt uitsluitend een gevalideerde canonieke persistence-patch', () => {
    expect(componentAllocationTimingPatch({
      allocationPercentage: '40',
      developmentStartMonth: 2,
      developmentEndMonth: 8,
      saleReceiptMonth: 10,
    })).toEqual({
      allocation_percentage: 40,
      development_start_month: 2,
      development_end_month: 8,
      rent_start_month: null,
      expected_sale_period_months: 10,
      hold_exit_month: null,
      allocation_timing_schema_version: COMPONENT_ALLOCATION_TIMING_SCHEMA_VERSION,
    });
  });

  it('blokkeert ongeldige percentages en onlogische volgordes vóór persistence', () => {
    expect(() => componentAllocationTimingPatch({ allocationPercentage: 0 })).toThrow(
      ComponentAllocationTimingValidationError,
    );
    expect(() => componentAllocationTimingPatch({
      allocationPercentage: 100,
      developmentStartMonth: 12,
      developmentEndMonth: 6,
    })).toThrow(/ontwikkel-einde kan niet vóór/i);
    expect(() => componentAllocationTimingPatch({
      allocationPercentage: 100,
      rentStartMonth: 18,
      terminalExitMonth: 12,
    })).toThrow(/terminale exit kan niet vóór/i);
  });

  it('ondersteunt een gemengde 60/40-verdeling binnen hetzelfde component', () => {
    const analysis = analyzeComponentAllocationTiming([
      unit({
        id: 'sale-part',
        allocation_percentage: 60,
        allocation_timing_schema_version: 1,
        expected_sale_period_months: 18,
      }),
      unit({
        id: 'hold-part',
        unit_label: 'Woning A — aanhouden',
        strategy: 'aanhouden',
        allocation_percentage: 40,
        allocation_timing_schema_version: 1,
        rent_start_month: 12,
        hold_exit_month: 60,
      }),
    ], 60);

    expect(analysis.groups).toEqual([
      {
        componentKey: 'component-1',
        unitIds: ['sale-part', 'hold-part'],
        labels: ['Woning A', 'Woning A — aanhouden'],
        totalAllocationPercentage: 100,
        status: 'complete',
        remainderPercentage: 0,
      },
    ]);
    expect(analysis.readyForPeriodicCashflow).toBe(true);
    expect(analysis.events.map((event) => [event.type, event.month, event.allocationPercentage])).toEqual([
      ['rent_start', 12, 40],
      ['sale_receipt', 18, 60],
      ['terminal_exit', 60, 40],
    ]);
  });

  it('signaleert overallocatie, ontbrekende allocatie en timing buiten de horizon', () => {
    const analysis = analyzeComponentAllocationTiming([
      unit({ id: 'a', allocation_percentage: 70, expected_sale_period_months: 24 }),
      unit({ id: 'b', allocation_percentage: 50, expected_sale_period_months: 72 }),
    ], 60);

    expect(analysis.readyForPeriodicCashflow).toBe(false);
    expect(analysis.groups[0]?.status).toBe('overallocated');
    expect(analysis.warnings).toContain('Woning A: allocaties tellen op tot 120% en overschrijden 100%.');
    expect(analysis.warnings).toContain('Woning A: verkoop in maand 72 valt buiten de Quickscan-horizon van 60 maanden.');
  });

  it('maakt een veilige 50/50-splitsing zonder identiteit of afgeleide outputs te klonen', () => {
    const split = buildComponentAllocationSplit(unit({
      id: 'source-id',
      allocation_percentage: 100,
      allocation_timing_schema_version: 1,
      expected_sale_period_months: 18,
      net_sale_proceeds: 500_000,
      created_at: '2026-07-28T00:00:00Z',
      updated_at: '2026-07-28T00:00:00Z',
    }));

    expect(split.currentPatch).toEqual({
      allocation_percentage: 50,
      allocation_timing_schema_version: 1,
    });
    expect(split.clonePatch.allocation_percentage).toBe(50);
    expect(split.clonePatch.component_id).toBe('component-1');
    expect(split.clonePatch.expected_sale_period_months).toBe(18);
    expect(split.clonePatch.unit_label).toBe('Woning A — deel 2');
    expect(split.clonePatch).not.toHaveProperty('id');
    expect(split.clonePatch).not.toHaveProperty('created_at');
    expect(split.clonePatch).not.toHaveProperty('net_sale_proceeds');
  });
});
