import { describe, it, expect } from 'vitest';
import { evaluateFeasibility } from '@/lib/vastgoedrekenen/feasibility';

describe('evaluateFeasibility', () => {
  it('returns ja als leading >= reference', () => {
    expect(evaluateFeasibility(1_000_000, 1_000_000).status).toBe('ja');
    expect(evaluateFeasibility(1_100_000, 1_000_000).status).toBe('ja');
  });

  it('returns bijna binnen 3% en €50k', () => {
    // tekort €20k op €1M = 2% → bijna
    expect(evaluateFeasibility(980_000, 1_000_000).status).toBe('bijna');
  });

  it('returns nee bij tekort > €50k', () => {
    // tekort €60k op €5M = 1.2% (binnen 3%) maar > €50k → nee
    expect(evaluateFeasibility(4_940_000, 5_000_000).status).toBe('nee');
  });

  it('returns nee bij tekort > 3% ook al < €50k', () => {
    // tekort €40k op €500k = 8% → nee
    expect(evaluateFeasibility(460_000, 500_000).status).toBe('nee');
  });

  it('marks hasReference false bij ontbrekend referentiebedrag', () => {
    expect(evaluateFeasibility(1_000_000, 0).hasReference).toBe(false);
    expect(evaluateFeasibility(1_000_000, null).hasReference).toBe(false);
  });
});
