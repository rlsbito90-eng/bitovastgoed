import { describe, expect, it } from 'vitest';
import { buildObjectIdentityMutationPackagePreview } from './mutationPackagePreview';

describe('Object-ID mutatiepakket-preview', () => {
  it('bouwt een geldige preview zonder writes', () => {
    const result = buildObjectIdentityMutationPackagePreview([
      {
        sourceType: 'object',
        sourceId: 'object-1',
        proposalType: 'link_existing_object',
        targetObjectId: 'crm-object-1',
        bagVerblijfsobjectId: '0363010000123456',
        bagPandId: '0363100012345678',
        reason: 'Eenduidige BAG-match.',
      },
    ]);

    expect(result).toMatchObject({
      status: 'preview_ready',
      dryRun: true,
      mutationAllowed: false,
      writes: 0,
      automaticMerges: 0,
      counts: { total: 1, linkExisting: 1 },
    });
  });

  it('blokkeert dubbele voorstellen voor hetzelfde bronrecord', () => {
    const proposal = {
      sourceType: 'vastgoedkans',
      sourceId: 'kans-1',
      proposalType: 'manual_review' as const,
      targetObjectId: null,
      bagVerblijfsobjectId: null,
      bagPandId: null,
      reason: 'Adres-only match.',
    };
    const result = buildObjectIdentityMutationPackagePreview([proposal, proposal]);
    expect(result.status).toBe('preview_blocked');
    expect(result.blockedReasons.join(' ')).toContain('Dubbel voorstel');
  });

  it('blokkeert automatische voorstellen zonder BAG-onderbouwing', () => {
    const result = buildObjectIdentityMutationPackagePreview([
      {
        sourceType: 'deal',
        sourceId: 'deal-1',
        proposalType: 'create_new_object',
        targetObjectId: null,
        bagVerblijfsobjectId: null,
        bagPandId: null,
        reason: 'Onvoldoende onderbouwing.',
      },
    ]);
    expect(result.status).toBe('preview_blocked');
  });
});
