import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => {
        insert(payload);
        return { select: () => ({ single: async () => ({ data: { id: 'nieuw' }, error: null }) }) };
      },
    }),
  },
}));

import { createManualTaskWithReminder, type ManualTaskInput } from '@/lib/tasks/reminders';

const input: ManualTaskInput = { titel: 'Bellen', objectId: 'o1', type: 'Algemeen', prioriteit: 'normaal', status: 'open', reminderSelection: 'default' };

describe('createManualTaskWithReminder — planning in dezelfde insert', () => {
  beforeEach(() => insert.mockReset());

  it('neemt plandatum en werkbak op in de ene insert', async () => {
    await expect(createManualTaskWithReminder(input, { planDatum: '2026-11-07', planTijd: null, planningBucket: 'open' })).resolves.toBe('nieuw');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ titel: 'Bellen', object_id: 'o1', deadline: null, plan_datum: '2026-11-07', plan_tijd: null, planning_bucket: 'open' });
  });

  it('zonder planning blijft de insert ongewijzigd', async () => {
    await createManualTaskWithReminder(input);
    expect(insert.mock.calls[0][0]).not.toHaveProperty('plan_datum');
    expect(insert.mock.calls[0][0]).not.toHaveProperty('planning_bucket');
  });
});
