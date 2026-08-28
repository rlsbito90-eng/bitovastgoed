import { describe, expect, it } from 'vitest';
import type { Taak } from '@/data/mock-data';
import {
  isTaskOverdue,
  isTaskPlannedToday,
  isTaskUpcoming,
} from '@/lib/tasks/workView';
import type { TaskPlanningMeta } from '@/lib/tasks/planning';

const now = new Date('2026-08-28T12:00:00+02:00');

function taak(overrides: Partial<Taak> = {}): Taak {
  return {
    id: 'task-1',
    titel: 'Testtaak',
    type: 'Algemeen',
    deadline: '',
    prioriteit: 'normaal',
    status: 'open',
    ...overrides,
  };
}

function planning(overrides: Partial<TaskPlanningMeta> = {}): TaskPlanningMeta {
  return {
    id: 'task-1',
    planDatum: null,
    planningBucket: 'open',
    ...overrides,
  };
}

describe('Mijn werk dagelijkse werklogica', () => {
  it('houdt een verlopen deadline apart van gepland Vandaag', () => {
    const task = taak({ deadline: '2026-08-27', deadlineTijd: '15:00' });
    expect(isTaskOverdue(task, now)).toBe(true);
    expect(isTaskPlannedToday(task, planning(), now)).toBe(false);
  });

  it('toont een expliciet voor vandaag geplande taak zonder deadline in Vandaag', () => {
    const task = taak();
    expect(isTaskPlannedToday(task, planning({ planDatum: '2026-08-28' }), now)).toBe(true);
    expect(isTaskOverdue(task, now)).toBe(false);
  });

  it('groepeert toekomstig gepland werk als Komend', () => {
    const task = taak();
    expect(isTaskUpcoming(task, planning({ planDatum: '2026-09-01' }), now)).toBe(true);
  });

  it('laat Later niet lekken naar Komend', () => {
    const task = taak({ deadline: '2026-09-01' });
    expect(isTaskUpcoming(task, planning({ planningBucket: 'later' }), now)).toBe(false);
  });
});
