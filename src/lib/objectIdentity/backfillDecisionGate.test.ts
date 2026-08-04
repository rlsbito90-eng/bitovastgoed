import { describe, expect, it } from 'vitest';
import { beoordeelBackfillKandidaat, type BackfillCandidate } from './backfillDecisionGate';

function candidate(overrides: Partial<BackfillCandidate> = {}): BackfillCandidate {
  return {
    sourceType: 'object',
    sourceId: 'source-1',
    matchedObjectIds: [],
    bagVerblijfsobjectId: null,
    bagPandId: '0363100012345678',
    matchedBy: null,
    conflictingIdentity: false,
    inventorySourceComplete: true,
    ...overrides,
  };
}

describe('Object-ID backfill stop-go contract', () => {
  it('stelt een nieuw object voor bij geldige BAG-identiteit zonder match', () => {
    expect(beoordeelBackfillKandidaat(candidate())).toMatchObject({
      decision: 'propose_new_object',
      mutationAllowed: false,
      writes: 0,
    });
  });

  it('accepteert uitsluitend één eenduidige bestaande match', () => {
    expect(beoordeelBackfillKandidaat(candidate({
      matchedObjectIds: ['object-1'],
      matchedBy: 'bag_pand_id',
    }))).toMatchObject({
      decision: 'link_existing_object',
      targetObjectId: 'object-1',
      mutationAllowed: false,
    });
  });

  it('blokkeert meerdere centrale Object-ID-kandidaten voor handmatige beoordeling', () => {
    expect(beoordeelBackfillKandidaat(candidate({
      matchedObjectIds: ['object-1', 'object-2'],
      matchedBy: 'address',
    })).decision).toBe('manual_review');
  });

  it('blokkeert tegenstrijdige identiteit', () => {
    expect(beoordeelBackfillKandidaat(candidate({ conflictingIdentity: true }))).toMatchObject({
      decision: 'manual_review',
      targetObjectId: null,
    });
  });

  it('blokkeert onvolledige broninventarisatie fail-closed', () => {
    expect(beoordeelBackfillKandidaat(candidate({ inventorySourceComplete: false }))).toMatchObject({
      decision: 'blocked',
      writes: 0,
    });
  });
});
