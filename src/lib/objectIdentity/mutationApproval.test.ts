import { describe, expect, it } from 'vitest';
import { beoordeelObjectIdentityMutatiepakket, type ObjectIdentityMutationProposalType } from './mutationApproval';

const basis = {
  packageId: 'pkg-001',
  packageHash: 'a'.repeat(64),
  proposalCount: 2,
  proposalTypes: ['link_existing_object'] as ObjectIdentityMutationProposalType[],
  sourceTypes: ['object'],
  environment: 'shadow' as const,
  reviewerId: 'admin-1',
  approvedAt: '2026-08-04T18:00:00.000Z',
  expiresAt: '2026-08-05T18:00:00.000Z',
  dryRun: true,
  writes: 0,
  automaticMerges: 0,
};

describe('Object-ID mutatiegoedkeuring', () => {
  it('accepteert uitsluitend een volledig en tijdelijk shadowpakket voor beoordeling', () => {
    const result = beoordeelObjectIdentityMutatiepakket(
      basis,
      new Date('2026-08-04T19:00:00.000Z'),
    );
    expect(result.status).toBe('approval_ready');
    expect(result.mutationAllowed).toBe(false);
    expect(result.writes).toBe(0);
    expect(result.approvedProposalCount).toBe(2);
  });

  it('blokkeert productie expliciet', () => {
    const result = beoordeelObjectIdentityMutatiepakket(
      { ...basis, environment: 'production' },
      new Date('2026-08-04T19:00:00.000Z'),
    );
    expect(result.status).toBe('approval_blocked');
    expect(result.issues.map(issue => issue.code)).toContain('production_forbidden');
  });

  it('blokkeert verlopen of onbeoordeelde pakketten', () => {
    const result = beoordeelObjectIdentityMutatiepakket(
      { ...basis, reviewerId: null, expiresAt: '2026-08-04T18:30:00.000Z' },
      new Date('2026-08-04T19:00:00.000Z'),
    );
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['missing_reviewer', 'expired_approval']),
    );
  });

  it('blokkeert handmatige beoordeling, writes en automatische merges', () => {
    const result = beoordeelObjectIdentityMutatiepakket(
      {
        ...basis,
        proposalTypes: ['manual_review'],
        writes: 1,
        automaticMerges: 1,
      },
      new Date('2026-08-04T19:00:00.000Z'),
    );
    expect(result.status).toBe('approval_blocked');
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining([
        'manual_review_in_mutation_scope',
        'writes_detected',
        'automatic_merges_detected',
      ]),
    );
  });
});
