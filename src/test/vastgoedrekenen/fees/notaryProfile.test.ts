import { describe, it, expect } from 'vitest';
import {
  computeNotaryFromProfile,
  defaultNotaryProfileFor,
  NOTARY_PROFILES,
} from '@/lib/vastgoedrekenen/fees/notaryProfile';

describe('notaris quickscan-profielen', () => {
  it('simpel woning € 500k → max(2000, 500) = 2000', () => {
    const r = computeNotaryFromProfile(500_000, 'woning_simpel');
    expect(r.amount).toBe(2000);
  });
  it('woning_belegging € 1M → max(2500, 1200) = 2500', () => {
    const r = computeNotaryFromProfile(1_000_000, 'woning_belegging');
    expect(r.amount).toBe(2500);
  });
  it('woning_belegging € 5M → percentage wint (6000)', () => {
    const r = computeNotaryFromProfile(5_000_000, 'woning_belegging');
    expect(r.amount).toBe(6000);
  });
  it('commercieel € 4M → max(3500, 6000) = 6000', () => {
    const r = computeNotaryFromProfile(4_000_000, 'commercieel');
    expect(r.amount).toBe(6000);
  });
  it('mixed_use € 2M → max(5000, 4000) = 5000', () => {
    const r = computeNotaryFromProfile(2_000_000, 'mixed_use');
    expect(r.amount).toBe(5000);
  });
  it('portefeuille vereist handmatige invoer', () => {
    const r = computeNotaryFromProfile(10_000_000, 'portefeuille');
    expect(r.requiresManual).toBe(true);
    expect(r.amount).toBe(0);
  });
  it('alle 5 profielen aanwezig', () => {
    expect(Object.keys(NOTARY_PROFILES)).toHaveLength(5);
  });
});

describe('defaultNotaryProfileFor', () => {
  it('default → woning_belegging', () => {
    expect(defaultNotaryProfileFor()).toBe('woning_belegging');
  });
  it('mixed object → mixed_use', () => {
    expect(defaultNotaryProfileFor(null, 'mixed_use')).toBe('mixed_use');
  });
  it('commerciële strategie → commercieel', () => {
    expect(defaultNotaryProfileFor('commercieel', null)).toBe('commercieel');
  });
});
