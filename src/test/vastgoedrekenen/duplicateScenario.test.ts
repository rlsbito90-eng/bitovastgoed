import { describe, expect, it } from 'vitest';
import {
  buildScenarioChildClone,
  nextScenarioCopyName,
  stripCloneIdentity,
} from '@/lib/vastgoedrekenen/duplicateScenario';

describe('scenario dupliceren', () => {
  it('maakt opeenvolgende unieke kopienamen', () => {
    expect(nextScenarioCopyName('Basisscenario', [])).toBe('Basisscenario (kopie)');
    expect(nextScenarioCopyName('Basisscenario', ['Basisscenario (kopie)']))
      .toBe('Basisscenario (kopie 2)');
    expect(nextScenarioCopyName('Basisscenario (kopie 2)', [
      'Basisscenario (kopie)',
      'Basisscenario (kopie 2)',
    ])).toBe('Basisscenario (kopie 3)');
  });

  it('neemt database-identiteit en timestamps niet over', () => {
    expect(stripCloneIdentity({
      id: 'oud',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      scenario_name: 'Basis',
      purchase_price: 1_000_000,
    })).toEqual({
      scenario_name: 'Basis',
      purchase_price: 1_000_000,
    });
  });

  it('zet scenario- en componentkoppelingen om', () => {
    const result = buildScenarioChildClone({
      id: 'unit-oud',
      scenario_id: 'scenario-oud',
      component_id: 'component-oud',
      unit_label: 'Voorhuis',
    }, 'scenario-nieuw', new Map([['component-oud', 'component-nieuw']]));

    expect(result).toEqual({
      scenario_id: 'scenario-nieuw',
      component_id: 'component-nieuw',
      unit_label: 'Voorhuis',
    });
  });

  it('maakt een verweesde componentkoppeling niet stilzwijgend ongeldig', () => {
    const result = buildScenarioChildClone({
      scenario_id: 'scenario-oud',
      component_id: 'onbekend',
      unit_label: 'Losse unit',
    }, 'scenario-nieuw');

    expect(result.component_id).toBeNull();
  });
});
