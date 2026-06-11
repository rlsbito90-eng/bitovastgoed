import { describe, it, expect } from 'vitest';
import { bouwGeoJson, heeftLocatie } from '@/components/offmarket/kaart/OffMarketKaart';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

function s(p: Partial<OffMarketSignaal>): OffMarketSignaal {
  return {
    id: p.id ?? 'x', titel: 'titel', status: 'nieuw_signaal' as never,
    prioriteit: 'midden' as never, type_signaal: 'overig' as never,
    assettype: 'overig' as never, bron_type: 'handmatig' as never,
    ...p,
  } as unknown as OffMarketSignaal;
}

describe('OffMarketKaart helpers', () => {
  it('heeftLocatie: geldige lat/lng', () => {
    expect(heeftLocatie(s({ lat: 52.37 as never, lng: 4.9 as never }))).toBe(true);
  });
  it('heeftLocatie: null', () => {
    expect(heeftLocatie(s({}))).toBe(false);
  });
  it('heeftLocatie: 0/0 afgewezen', () => {
    expect(heeftLocatie(s({ lat: 0 as never, lng: 0 as never }))).toBe(false);
  });
  it('bouwGeoJson sluit signalen zonder lat/lng uit', () => {
    const fc = bouwGeoJson([
      s({ id: 'a', lat: 52.37 as never, lng: 4.9 as never }),
      s({ id: 'b' }),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.id).toBe('a');
  });
  it('bouwGeoJson zet prioriteitskleur in properties', () => {
    const fc = bouwGeoJson([s({ id: 'a', lat: 52.37 as never, lng: 4.9 as never, prioriteit: 'urgent' as never })]);
    expect(fc.features[0].properties?.kleur).toBe('#dc2626');
  });
});
