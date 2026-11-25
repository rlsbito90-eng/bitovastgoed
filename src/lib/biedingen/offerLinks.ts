type Link = { id: string; objectId: string; relatieId: string };
type DealLink = Link & { isArchived?: boolean; softDeletedAt?: string; fase: string };

export function matchingOfferDeals<T extends DealLink>(deals: T[], objectId: string, relatieId: string): T[] {
  if (!objectId || !relatieId) return [];
  return deals.filter(d => d.objectId === objectId && d.relatieId === relatieId &&
    !d.isArchived && !d.softDeletedAt && d.fase !== 'afgerond' && d.fase !== 'afgevallen');
}

/** Auto-link only an unambiguous direct object/buyer match; never link another buyer. */
export function resolveOfferLink<T extends Link>(matches: T[], preferredId?: string | null): string | null {
  if (preferredId && matches.some(m => m.id === preferredId)) return preferredId;
  return matches.length === 1 ? matches[0].id : null;
}

export function matchingOfferCandidates<T extends Link>(candidates: T[], objectId: string, relatieId: string): T[] {
  if (!objectId || !relatieId) return [];
  return candidates.filter(c => c.objectId === objectId && c.relatieId === relatieId);
}
