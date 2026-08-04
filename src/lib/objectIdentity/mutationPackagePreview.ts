export type ObjectIdentityMutationProposalType =
  | 'link_existing_object'
  | 'create_new_object'
  | 'manual_review';

export interface ObjectIdentityMutationProposal {
  sourceType: string;
  sourceId: string;
  proposalType: ObjectIdentityMutationProposalType;
  targetObjectId: string | null;
  bagVerblijfsobjectId: string | null;
  bagPandId: string | null;
  reason: string;
}

export interface ObjectIdentityMutationPackagePreview {
  status: 'preview_ready' | 'preview_blocked';
  dryRun: true;
  mutationAllowed: false;
  writes: 0;
  automaticMerges: 0;
  proposals: ObjectIdentityMutationProposal[];
  blockedReasons: string[];
  counts: {
    total: number;
    linkExisting: number;
    createNew: number;
    manualReview: number;
  };
}

function isBagId(value: string | null): boolean {
  return value === null || /^\d{16}$/.test(value);
}

export function buildObjectIdentityMutationPackagePreview(
  proposals: ObjectIdentityMutationProposal[],
): ObjectIdentityMutationPackagePreview {
  const blockedReasons: string[] = [];
  const uniqueSourceKeys = new Set<string>();

  for (const proposal of proposals) {
    const sourceKey = `${proposal.sourceType}:${proposal.sourceId}`;
    if (!proposal.sourceType.trim() || !proposal.sourceId.trim()) {
      blockedReasons.push('Elk voorstel vereist een stabiel brontype en bron-ID.');
    }
    if (uniqueSourceKeys.has(sourceKey)) {
      blockedReasons.push(`Dubbel voorstel voor ${sourceKey}.`);
    }
    uniqueSourceKeys.add(sourceKey);

    if (!isBagId(proposal.bagVerblijfsobjectId) || !isBagId(proposal.bagPandId)) {
      blockedReasons.push(`Ongeldige BAG-identiteit voor ${sourceKey}.`);
    }
    if (proposal.proposalType === 'link_existing_object' && !proposal.targetObjectId) {
      blockedReasons.push(`Koppelvoorstel zonder doelobject voor ${sourceKey}.`);
    }
    if (proposal.proposalType === 'create_new_object' && proposal.targetObjectId) {
      blockedReasons.push(`Nieuw-objectvoorstel bevat al een doelobject voor ${sourceKey}.`);
    }
    if (proposal.proposalType !== 'manual_review' && !proposal.bagVerblijfsobjectId && !proposal.bagPandId) {
      blockedReasons.push(`Automatisch voorstel zonder BAG-onderbouwing voor ${sourceKey}.`);
    }
  }

  return {
    status: blockedReasons.length === 0 ? 'preview_ready' : 'preview_blocked',
    dryRun: true,
    mutationAllowed: false,
    writes: 0,
    automaticMerges: 0,
    proposals,
    blockedReasons: [...new Set(blockedReasons)],
    counts: {
      total: proposals.length,
      linkExisting: proposals.filter(item => item.proposalType === 'link_existing_object').length,
      createNew: proposals.filter(item => item.proposalType === 'create_new_object').length,
      manualReview: proposals.filter(item => item.proposalType === 'manual_review').length,
    },
  };
}
