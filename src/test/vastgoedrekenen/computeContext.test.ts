import { describe, expect, it } from 'vitest';
import type { AcquisitionComponent } from '@/lib/vastgoedrekenen/acquisition';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { buildScenarioComputeContext } from '@/lib/vastgoedrekenen/computeContext';
import type { TaxSettings, WwsUnit } from '@/lib/vastgoedrekenen/types';
import { comp, cost, scen, unit } from './golden/fixtures';

function acquisition(
  id: string,
  value: number,
  classification: AcquisitionComponent['transfer_tax_classification'],
): AcquisitionComponent {
  return {
    id,
    scenario_id: 's1',
    component_name: id,
    component_type: classification === 'niet_woning' ? 'horeca' : 'appartement',
    floor_or_location: null,
    surface_gbo: null,
    surface_vvo: null,
    surface_bvo: null,
    allocated_component_value: value,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: classification,
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    source_note: null,
    reliability_status: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const scenario = scen({
  purchase_price: 1_000_000,
  asking_price: 1_050_000,
  ovb_mode: 'per_component',
  strategy_type: 'buy_transform_sell',
  sale_strategy: 'verkoop_per_unit',
  bid_basis: 'verkoop',
  sale_target_margin_percentage: 10,
  sale_target_roi_percentage: 12,
});

const legacyComponents = [
  comp({
    id: 'legacy-a',
    allocated_component_value: 600_000,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: 'woning_belegging',
  }),
  comp({
    id: 'legacy-b',
    allocated_component_value: 400_000,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: 'woning_belegging',
  }),
];

const acquisitionComponents = [
  acquisition('acquisition-home', 600_000, 'woning_belegging'),
  acquisition('acquisition-commercial', 400_000, 'niet_woning'),
];

const costs = [cost({ amount: 100_000, calc_mode: 'totaal' })];
const wwsUnits = [{ id: 'wws-1', scenario_id: 's1', wws_points: 190 }] as unknown as WwsUnit[];
const strategyUnits = [
  unit({
    id: 'strategy-1',
    strategy: 'transformeren_verkopen',
    sale_price_source: 'totaal',
    sale_price_total: 2_000_000,
    sale_costs_pct: 1.5,
    transformation_costs: 200_000,
  }),
];
const taxSettings = { id: 'tax-1' } as unknown as TaxSettings;

function completeInput() {
  return {
    scenario,
    components: legacyComponents,
    acquisitionComponents,
    costs,
    wwsUnits,
    strategyUnits,
    taxSettings,
    objectType: 'mixed_use' as const,
    objectArea: 200,
    objectWoz: 900_000,
    objectEnergyLabel: 'B',
    objectBouwjaar: 1980,
    propertyType: 'mixed_use' as const,
  };
}

describe('centrale computecontext', () => {
  it('neemt acquisitionComponents volledig mee', () => {
    const context = buildScenarioComputeContext(completeInput());

    expect(context.acquisitionComponents).toEqual(acquisitionComponents);
    expect(context.acquisitionComponents).not.toBe(acquisitionComponents);
  });

  it('neemt strategyUnits volledig mee', () => {
    const context = buildScenarioComputeContext(completeInput());

    expect(context.strategyUnits).toEqual(strategyUnits);
    expect(context.strategyUnits).not.toBe(strategyUnits);
  });

  it('neemt kosten, WWS, fiscale instellingen en objectmetadata mee', () => {
    const context = buildScenarioComputeContext(completeInput());

    expect(context.costs).toEqual(costs);
    expect(context.wwsUnits).toEqual(wwsUnits);
    expect(context.taxSettings).toBe(taxSettings);
    expect(context.objectArea).toBe(200);
    expect(context.objectWoz).toBe(900_000);
    expect(context.objectEnergyLabel).toBe('B');
    expect(context.objectBouwjaar).toBe(1980);
    expect(context.propertyType).toBe('mixed_use');
  });

  it('muteert de brondata niet', () => {
    const input = completeInput();
    const before = structuredClone(input);
    const context = buildScenarioComputeContext(input);

    computeScenario(context);

    expect(input).toEqual(before);
    expect(context.components).not.toBe(input.components);
    expect(context.costs).not.toBe(input.costs);
    expect(context.wwsUnits).not.toBe(input.wwsUnits);
  });

  it('verwerkt ontbrekende optionele datasets veilig', () => {
    const context = buildScenarioComputeContext({
      scenario: scen({}),
      objectType: 'enkelvoudig',
    });

    expect(context.components).toEqual([]);
    expect(context.costs).toEqual([]);
    expect(context.wwsUnits).toEqual([]);
    expect(context.acquisitionComponents).toBeUndefined();
    expect(context.strategyUnits).toBeUndefined();
    expect(context.taxSettings).toBeNull();
    expect(context.objectArea).toBeNull();
    expect(() => computeScenario(context)).not.toThrow();
  });

  it('behoudt de legacyfallback wanneer verkrijgingsdelen ontbreken', () => {
    const legacyContext = buildScenarioComputeContext({
      ...completeInput(),
      acquisitionComponents: undefined,
      taxSettings: null,
    });
    const currentContext = buildScenarioComputeContext({
      ...completeInput(),
      taxSettings: null,
    });

    const legacyResult = computeScenario(legacyContext);
    const currentResult = computeScenario(currentContext);

    expect(legacyResult.totalTransferTax).toBe(80_000);
    expect(currentResult.totalTransferTax).toBe(89_600);
  });
});

describe('computepariteit editor en scenariovergelijking', () => {
  it('geeft met dezelfde volledige context dezelfde financiële uitkomsten', () => {
    const editorContext = buildScenarioComputeContext({
      ...completeInput(),
      taxSettings: null,
    });
    const comparisonContext = buildScenarioComputeContext({
      ...completeInput(),
      taxSettings: null,
    });

    const editor = computeScenario(editorContext);
    const comparison = computeScenario(comparisonContext);
    const legacy = computeScenario(buildScenarioComputeContext({
      ...completeInput(),
      acquisitionComponents: undefined,
      taxSettings: null,
    }));

    expect(editor.totalTransferTax).toBe(89_600);
    expect(editor.totalTransferTax).not.toBe(legacy.totalTransferTax);
    expect(comparison.totalTransferTax).toBe(editor.totalTransferTax);
    expect(comparison.totalInvestment).toBe(editor.totalInvestment);
    expect(comparison.maximumBid).toBe(editor.maximumBid);
    expect(comparison.leadingMaxValue).toBe(editor.leadingMaxValue);
    expect(comparison.roi).toBe(editor.roi);
    expect(comparison.netMargin).toBe(editor.netMargin);
  });
});
