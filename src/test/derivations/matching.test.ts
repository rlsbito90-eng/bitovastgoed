import { describe, it, expect } from 'vitest';
import {
  STRONG_MATCH_THRESHOLD,
  EXCELLENT_MATCH_THRESHOLD,
  isStrongMatch,
  isExcellentMatch,
} from '@/lib/derivations/matching';

describe('matching — drempels', () => {
  it('STRONG drempel = 70, EXCELLENT = 85', () => {
    expect(STRONG_MATCH_THRESHOLD).toBe(70);
    expect(EXCELLENT_MATCH_THRESHOLD).toBe(85);
  });

  it('isStrongMatch: 69 niet, 70 wel, 85 wel', () => {
    expect(isStrongMatch(69)).toBe(false);
    expect(isStrongMatch(70)).toBe(true);
    expect(isStrongMatch(85)).toBe(true);
  });

  it('isStrongMatch: non-numeriek geeft false', () => {
    expect(isStrongMatch(undefined)).toBe(false);
    expect(isStrongMatch(null)).toBe(false);
    expect(isStrongMatch('abc')).toBe(false);
    expect(isStrongMatch(NaN)).toBe(false);
  });

  it('isExcellentMatch op 85 drempel', () => {
    expect(isExcellentMatch(84)).toBe(false);
    expect(isExcellentMatch(85)).toBe(true);
  });
});
