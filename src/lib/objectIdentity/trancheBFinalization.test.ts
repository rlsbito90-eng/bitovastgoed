import { describe, expect, it } from 'vitest';
import {
  buildRollbackPlan,
  finalizeTrancheB,
  type TrancheBApprovedPackage,
  type TrancheBExecutionBoundary,
} from './trancheBFinalization';

const approvedPackage: TrancheBApprovedPackage = {
  packageId: 'object-id-shadow-001',
  packageHash: 'a'.repeat(64),
  environment: 'shadow',
  approvedBy: 'Ramysh Bito',
  approvedAt: '2026-08-04T18:00:00.000Z',
  expiresAt: '2026-08-05T18:00:00.000Z',
  proposedWrites: 25,
  manualReviewItems: 0,
};

const boundary: TrancheBExecutionBoundary = {
  environment: 'shadow',
  maxWrites: 25,
  auditEnabled: true,
  rollbackEnabled: true,
  productionBlocked: true,
};

describe('finalizeTrancheB', () => {
  it('verklaart de tranche gereed zonder uitvoering toe te staan', () => {
    const result = finalizeTrancheB(
      approvedPackage,
      boundary,
      new Date('2026-08-04T20:00:00.000Z'),
    );

    expect(result.status).toBe('tranche_b_ready');
    expect(result.reasons).toEqual([]);
    expect(result.executionAllowed).toBe(false);
    expect(result.productionAllowed).toBe(false);
    expect(result.requiresSeparateExecutionAuthorization).toBe(true);
  });

  it('blokkeert productie en ontbrekende rollback', () => {
    const result = finalizeTrancheB(
      { ...approvedPackage, environment: 'production' },
      {
        ...boundary,
        environment: 'production',
        rollbackEnabled: false,
        productionBlocked: false,
      },
      new Date('2026-08-04T20:00:00.000Z'),
    );

    expect(result.status).toBe('tranche_b_blocked');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'package_not_shadow',
        'boundary_not_shadow',
        'production_not_blocked',
        'rollback_missing',
      ]),
    );
  });

  it('blokkeert verlopen goedkeuring, handmatige dossiers en overschrijding', () => {
    const result = finalizeTrancheB(
      {
        ...approvedPackage,
        expiresAt: '2026-08-04T19:00:00.000Z',
        proposedWrites: 26,
        manualReviewItems: 1,
      },
      boundary,
      new Date('2026-08-04T20:00:00.000Z'),
    );

    expect(result.status).toBe('tranche_b_blocked');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'approval_expired',
        'manual_review_in_scope',
        'write_limit_exceeded',
      ]),
    );
  });
});

describe('buildRollbackPlan', () => {
  it('maakt voor iedere auditregel een deterministische herstelregel', () => {
    expect(
      buildRollbackPlan([
        {
          packageId: 'object-id-shadow-001',
          sourceType: 'object',
          sourceId: 'obj-1',
          action: 'link_existing_object',
          beforeObjectId: null,
          afterObjectId: 'crm-object-1',
          bagVerblijfsobjectId: '0363010000000001',
          bagPandId: '0363100000000001',
        },
      ]),
    ).toEqual([
      {
        sourceType: 'object',
        sourceId: 'obj-1',
        restoreObjectId: null,
      },
    ]);
  });
});
