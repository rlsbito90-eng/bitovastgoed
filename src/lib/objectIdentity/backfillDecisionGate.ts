export type BackfillDecision =
  | 'link_existing_object'
  | 'propose_new_object'
  | 'manual_review'
  | 'blocked';

export interface BackfillCandidate {
  sourceType: string;
  sourceId: string;
  matchedObjectIds: string[];
  bagVerblijfsobjectId: string | null;
  bagPandId: string | null;
  matchedBy: 'bag_verblijfsobject_id' | 'bag_pand_id' | 'address' | null;
  conflictingIdentity: boolean;
  inventorySourceComplete: boolean;
}

export interface BackfillDecisionResult {
  decision: BackfillDecision;
  targetObjectId: string | null;
  reason: string;
  mutationAllowed: false;
  writes: 0;
}

export function beoordeelBackfillKandidaat(
  candidate: BackfillCandidate,
): BackfillDecisionResult {
  if (!candidate.sourceId || !candidate.inventorySourceComplete) {
    return {
      decision: 'blocked',
      targetObjectId: null,
      reason: 'Bronrecord of broninventarisatie is onvolledig.',
      mutationAllowed: false,
      writes: 0,
    };
  }

  if (candidate.conflictingIdentity) {
    return {
      decision: 'manual_review',
      targetObjectId: null,
      reason: 'BAG- of adresidentiteit is onderling tegenstrijdig.',
      mutationAllowed: false,
      writes: 0,
    };
  }

  const uniqueMatches = [...new Set(candidate.matchedObjectIds.filter(Boolean))];
  if (uniqueMatches.length > 1) {
    return {
      decision: 'manual_review',
      targetObjectId: null,
      reason: 'Meerdere centrale Object-ID-kandidaten gevonden.',
      mutationAllowed: false,
      writes: 0,
    };
  }

  if (uniqueMatches.length === 1 && candidate.matchedBy) {
    return {
      decision: 'link_existing_object',
      targetObjectId: uniqueMatches[0],
      reason: `Eenduidige match via ${candidate.matchedBy}.`,
      mutationAllowed: false,
      writes: 0,
    };
  }

  if (
    candidate.matchedObjectIds.length === 0 &&
    (candidate.bagVerblijfsobjectId || candidate.bagPandId)
  ) {
    return {
      decision: 'propose_new_object',
      targetObjectId: null,
      reason: 'Geldige BAG-identiteit zonder bestaand centraal object.',
      mutationAllowed: false,
      writes: 0,
    };
  }

  return {
    decision: 'manual_review',
    targetObjectId: null,
    reason: 'Geen eenduidige BAG-onderbouwde beslissing mogelijk.',
    mutationAllowed: false,
    writes: 0,
  };
}
