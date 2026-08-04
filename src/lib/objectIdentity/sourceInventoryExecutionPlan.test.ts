import { describe, expect, it } from 'vitest';
import {
  maakBroninventarisatieUitvoerplan,
  valideerBroninventarisatiePagina,
} from './sourceInventoryExecutionPlan';

describe('Object-ID broninventarisatie uitvoerplan', () => {
  it('plant alle vijf bronnen als uitsluitend read-only select', () => {
    const plan = maakBroninventarisatieUitvoerplan();
    expect(plan.status).toBe('execution_plan_ready');
    expect(plan.readOnly).toBe(true);
    expect(plan.writes).toBe(0);
    expect(plan.automaticMerges).toBe(0);
    expect(plan.steps).toHaveLength(5);
    expect(plan.steps.every(step => step.operation === 'select')).toBe(true);
    expect(plan.steps.every(step => step.failureMode === 'isolate_source')).toBe(true);
  });

  it('begrensd paginaformaat voorkomt ongerichte bulkreads', () => {
    expect(() => maakBroninventarisatieUitvoerplan({ pageSize: 1001 })).toThrow();
    expect(maakBroninventarisatieUitvoerplan({ pageSize: 250 }).pageSize).toBe(250);
  });

  it('isoleert een te grote bronpagina als fout', () => {
    expect(() =>
      valideerBroninventarisatiePagina('object', new Array(501).fill({}), 500),
    ).toThrow('overschrijdt pageSize');
  });

  it('accepteert een begrensde lege of gevulde pagina', () => {
    expect(valideerBroninventarisatiePagina('vastgoedkans', [], 500)).toEqual({
      valid: true,
      rowCount: 0,
    });
    expect(valideerBroninventarisatiePagina('deal', [{ id: '1' }], 500)).toEqual({
      valid: true,
      rowCount: 1,
    });
  });
});
