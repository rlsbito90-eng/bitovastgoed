import { describe, expect, it } from 'vitest';
import {
  latestQuickscanActivity,
  sortQuickscansByLatestActivity,
} from '@/lib/vastgoedrekenen/quickscanOverview';

const calculations = [
  {
    id: 'quickscan-1',
    object_id: 'den-haag',
    calculation_name: 'Quickscan 1',
    created_at: '2026-07-16T20:34:00.000Z',
    updated_at: '2026-07-16T20:34:00.000Z',
  },
  {
    id: 'quickscan-2',
    object_id: 'den-haag',
    calculation_name: 'Quickscan 2',
    created_at: '2026-07-23T15:48:53.000Z',
    updated_at: '2026-07-23T15:48:53.000Z',
  },
  {
    id: 'other',
    object_id: 'rotterdam',
    calculation_name: 'Quickscan 1',
    created_at: '2026-07-20T10:00:00.000Z',
    updated_at: '2026-07-20T10:00:00.000Z',
  },
];

const scenarios = [
  {
    calculation_id: 'quickscan-1',
    created_at: '2026-07-24T11:30:36.000Z',
    updated_at: '2026-07-27T22:00:00.000Z',
  },
];

describe('quickscanOverview', () => {
  it('gebruikt de laatste scenarioactiviteit voor de quickscanvolgorde', () => {
    const sorted = sortQuickscansByLatestActivity(calculations, scenarios);

    expect(sorted.map((item) => item.id)).toEqual([
      'quickscan-1',
      'quickscan-2',
      'other',
    ]);
  });

  it('valt terug op de quickscan zelf wanneer er geen scenario is', () => {
    expect(latestQuickscanActivity(calculations[1], scenarios)).toBe(
      Date.parse('2026-07-23T15:48:53.000Z'),
    );
  });

  it('sorteert stabiel en numeriek bij gelijke activiteit', () => {
    const sameTime = calculations.slice(0, 2).map((calculation) => ({
      ...calculation,
      created_at: '2026-07-28T00:00:00.000Z',
      updated_at: '2026-07-28T00:00:00.000Z',
    }));

    const sorted = sortQuickscansByLatestActivity(sameTime, []);

    expect(sorted.map((item) => item.calculation_name)).toEqual([
      'Quickscan 1',
      'Quickscan 2',
    ]);
  });
});
