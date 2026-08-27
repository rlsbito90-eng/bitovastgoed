import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BAG_AMSTERDAM_RING_WIJK_SENTINEL,
  echteWijkCodes,
  heeftBinnenRingFilter,
  zetBinnenRingFilter,
} from './amsterdamRingFilter';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Pandenverkenner Binnen de ring', () => {
  it('houdt de pseudo-wijkcode gescheiden van echte CBS-wijken', () => {
    expect(BAG_AMSTERDAM_RING_WIJK_SENTINEL).toBe('WK0363RG');
    expect(echteWijkCodes(['WK036301', 'WK0363RG', 'WK036302'])).toEqual(['WK036301', 'WK036302']);
    expect(heeftBinnenRingFilter(['WK0363RG'])).toBe(true);
    expect(zetBinnenRingFilter(['WK036301'], true)).toEqual(['WK036301', 'WK0363RG']);
    expect(zetBinnenRingFilter(['WK036301', 'WK0363RG'], false)).toEqual(['WK036301']);
  });

  it('toont de filter expliciet in de Pandenverkenner en bewaart hem via wijkCodes', () => {
    const ui = source('src/components/bag/BagGebiedsfilters.tsx');
    expect(ui).toContain('data-testid="pandenverkenner-binnen-ring-filter"');
    expect(ui).toContain('Amsterdam binnen de A10, ten zuiden van het IJ');
    expect(ui).toContain('zetBinnenRingFilter');
  });

  it('borgt dezelfde A10-polygon als Radar in de BAG SQL-patch', () => {
    const radar = source('src/lib/offMarket/amsterdamRing.ts');
    const sql = source('experiments/bag/pandenverkenner-binnen-ring.sql');
    for (const coordinate of [
      '4.7960 52.3845', '4.7900 52.3390', '4.8500 52.3180',
      '4.9670 52.3680', '4.9500 52.3890', '4.8250 52.3850',
    ]) {
      const [lng, lat] = coordinate.split(' ');
      expect(radar).toContain(`[${lng}, ${lat}]`);
      expect(sql).toContain(coordinate);
    }
    expect(sql).toContain('bag_service.is_binnen_amsterdam_ring(i.centroid)');
  });
});
