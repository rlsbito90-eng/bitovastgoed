import { describe, expect, it } from 'vitest';
import { amsterdamRingLigging, isBinnenAmsterdamRing } from '@/lib/offMarket/amsterdamRing';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

function signaal(args: {
  plaats?: string | null;
  gemeente?: string | null;
  lat?: number | null;
  lng?: number | null;
}): OffMarketSignaal {
  return {
    id: 'test-signaal',
    titel: 'Test',
    plaats: args.plaats ?? null,
    lat: args.lat ?? null,
    lng: args.lng ?? null,
    geo_gemeente_naam: args.gemeente ?? null,
  } as unknown as OffMarketSignaal;
}

describe('Amsterdam binnen-ring classificatie', () => {
  it('classificeert centrum als binnen ring', () => {
    const s = signaal({ plaats: 'Amsterdam', gemeente: 'Amsterdam', lat: 52.3731, lng: 4.8922 });
    expect(amsterdamRingLigging(s)).toBe('binnen_ring');
    expect(isBinnenAmsterdamRing(s)).toBe(true);
  });

  it('classificeert De Pijp als binnen ring', () => {
    const s = signaal({ plaats: 'Amsterdam', gemeente: 'Amsterdam', lat: 52.3530, lng: 4.8940 });
    expect(amsterdamRingLigging(s)).toBe('binnen_ring');
  });

  it('classificeert Amsterdam-Noord bewust als buiten ring', () => {
    const s = signaal({ plaats: 'Amsterdam', gemeente: 'Amsterdam', lat: 52.4010, lng: 4.9140 });
    expect(amsterdamRingLigging(s)).toBe('buiten_ring');
  });

  it('classificeert Amsterdam buiten de A10 als buiten ring', () => {
    const s = signaal({ plaats: 'Amsterdam', gemeente: 'Amsterdam', lat: 52.3560, lng: 4.7790 });
    expect(amsterdamRingLigging(s)).toBe('buiten_ring');
  });

  it('geeft onbekend voor Amsterdam zonder coordinaten', () => {
    const s = signaal({ plaats: 'Amsterdam', gemeente: 'Amsterdam' });
    expect(amsterdamRingLigging(s)).toBe('onbekend');
  });

  it('houdt niet-Amsterdam apart van buiten ring', () => {
    const s = signaal({ plaats: 'Rotterdam', gemeente: 'Rotterdam', lat: 51.9244, lng: 4.4777 });
    expect(amsterdamRingLigging(s)).toBe('niet_amsterdam');
  });
});
