import { describe, expect, it } from 'vitest';
import {
  dealFollowUpIdentity,
  findActiveTaskForSource,
  hasCompleteTaskSourceIdentity,
  pipelineNextActionIdentity,
  vastgoedkansNextActionIdentity,
} from '@/lib/tasks/sourceIdentity';

describe('canonieke bronidentiteit voor taken', () => {
  it('bouwt stabiele identities per domein-actieslot', () => {
    expect(dealFollowUpIdentity('deal-1')).toEqual({
      sourceKind: 'deal',
      sourceId: 'deal-1',
      sourceSlot: 'follow_up',
    });
    expect(pipelineNextActionIdentity('pipe-1')).toEqual({
      sourceKind: 'object_pipeline',
      sourceId: 'pipe-1',
      sourceSlot: 'volgende_actie',
    });
    expect(vastgoedkansNextActionIdentity('vk-1')).toEqual({
      sourceKind: 'vastgoedkans',
      sourceId: 'vk-1',
      sourceSlot: 'volgende_actie',
    });
  });

  it('accepteert alleen complete source-identities', () => {
    expect(hasCompleteTaskSourceIdentity({ sourceKind: 'deal', sourceId: 'd', sourceSlot: 'follow_up' } as any)).toBe(true);
    expect(hasCompleteTaskSourceIdentity({ sourceKind: 'deal', sourceId: 'd' } as any)).toBe(false);
  });

  it('negeert afgeronde, geannuleerde en verwijderde taken', () => {
    const identity = dealFollowUpIdentity('deal-1');
    const tasks = [
      { id: 'done', status: 'afgerond', sourceKind: 'deal', sourceId: 'deal-1', sourceSlot: 'follow_up' },
      { id: 'cancelled', status: 'geannuleerd', sourceKind: 'deal', sourceId: 'deal-1', sourceSlot: 'follow_up' },
      { id: 'deleted', status: 'open', softDeletedAt: '2026-08-18', sourceKind: 'deal', sourceId: 'deal-1', sourceSlot: 'follow_up' },
      { id: 'active', status: 'open', sourceKind: 'deal', sourceId: 'deal-1', sourceSlot: 'follow_up' },
    ] as any[];

    expect(findActiveTaskForSource(tasks, identity)?.id).toBe('active');
  });

  it('kiest deterministisch de vroegste actieve legacy-match als er vóór de unique-index meerdere bestaan', () => {
    const identity = dealFollowUpIdentity('deal-1');
    const tasks = [
      { id: 'later', status: 'open', deadline: '2026-08-25', sourceKind: 'deal', sourceId: 'deal-1', sourceSlot: 'follow_up' },
      { id: 'earlier', status: 'open', deadline: '2026-08-20', sourceKind: 'deal', sourceId: 'deal-1', sourceSlot: 'follow_up' },
    ] as any[];

    expect(findActiveTaskForSource(tasks, identity)?.id).toBe('earlier');
  });
});
