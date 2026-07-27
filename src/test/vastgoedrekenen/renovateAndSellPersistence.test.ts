import { describe, expect, it } from 'vitest';
import {
  OTHER_PROJECT_COST_KEY,
  RENOVATION_COST_KEY,
  isRenovateAndSellOwnedCost,
  renovateAndSellCostNote,
} from '@/lib/vastgoedrekenen/propositions';

describe('Fase 2A.3 — persistente adapter-owned kosten', () => {
  it('gebruikt stabiele ownership-markers voor renovatie- en overige projectkosten', () => {
    const renovation = renovateAndSellCostNote({
      ownershipKey: RENOVATION_COST_KEY,
      category: 'bouwkosten',
      description: 'Renovatiekosten',
      amount: 100,
      source: 'proposition:renovate_and_sell',
    });
    const other = renovateAndSellCostNote({
      ownershipKey: OTHER_PROJECT_COST_KEY,
      category: 'overig',
      description: 'Overige projectkosten',
      amount: 25,
      source: 'proposition:renovate_and_sell',
    });

    expect(renovation).toBe(`adapter-owned:${RENOVATION_COST_KEY}`);
    expect(other).toBe(`adapter-owned:${OTHER_PROJECT_COST_KEY}`);
    expect(isRenovateAndSellOwnedCost({ notes: renovation })).toBe(true);
    expect(isRenovateAndSellOwnedCost({ notes: other })).toBe(true);
  });

  it('beschouwt handmatige kostenregels niet als adapter-owned', () => {
    expect(isRenovateAndSellOwnedCost({ notes: null })).toBe(false);
    expect(isRenovateAndSellOwnedCost({ notes: 'handmatig ingevoerd' })).toBe(false);
    expect(isRenovateAndSellOwnedCost({ notes: 'adapter-owned:andere-propositie' })).toBe(false);
  });
});
