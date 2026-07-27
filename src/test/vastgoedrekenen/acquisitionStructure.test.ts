import { describe, expect, it } from 'vitest';
import { computeScenarioOvb } from '@/lib/vastgoedrekenen/ovb';
import type { AcquisitionComponent, TransferTaxComponent } from '@/lib/vastgoedrekenen/acquisition';
import type { Scenario } from '@/lib/vastgoedrekenen/types';

const scenario = { purchase_price: 1_850_000, ovb_mode: 'per_component', ovb_classification: 'mixed_use' } as Scenario;

function acquisition(id: string, value: number, classification: AcquisitionComponent['transfer_tax_classification']): TransferTaxComponent {
  return {
    id,
    scenario_id: 'scenario',
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
    created_at: '',
    updated_at: '',
  } as unknown as TransferTaxComponent;
}

describe('aparte verkrijgingsstructuur', () => {
  it('verdeelt de aankoopprijs exact over huidige verkrijgingscomponenten', () => {
    const result = computeScenarioOvb(scenario, [
      acquisition('horeca', 250_000, 'niet_woning'),
      acquisition('bestaande-woningen', 600_000, 'woning_belegging'),
      acquisition('ontwikkeldeel', 1_000_000, 'woning_belegging'),
    ], null, 'mixed_use');

    expect(result.perComponent.reduce((sum, row) => sum + row.basisValue, 0)).toBe(1_850_000);
    expect(result.totalOvb).toBeGreaterThan(0);
  });

  it('behandelt één vrijgesteld verkrijgingsdeel als één fiscale regel, ongeacht toekomstige unitverdeling', () => {
    const result = computeScenarioOvb(scenario, [
      acquisition('bestaand', 850_000, 'niet_woning'),
      acquisition('ontwikkeldeel', 1_000_000, 'vrijgesteld'),
    ], null, 'mixed_use');

    expect(result.perComponent).toHaveLength(2);
    expect(result.perComponent.find((row) => row.id === 'ontwikkeldeel')?.amount).toBe(0);
  });
});
