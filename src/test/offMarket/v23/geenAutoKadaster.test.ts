// V2.3 — Compliance: BAG-pad start nooit een betaalde Kadaster-aanvraag.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('V2.3 — geen automatische Kadaster-aanvraag', () => {
  it('BAG-helpers roepen geen kadaster-edge-function aan', () => {
    const files = [
      'src/lib/offMarket/bag/autoTrigger.ts',
      'src/lib/offMarket/bag/kadasteradvies.ts',
      'src/lib/offMarket/bag/triggers.ts',
      'src/lib/offMarket/bag/types.ts',
      'src/hooks/useBagVerrijken.tsx',
    ];
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/kadaster-objectinformatie/);
      expect(src).not.toMatch(/useKadasterObjectinformatie/);
    }
  });

  it('BAG-edge-function roept geen betaalde Kadaster-API aan', () => {
    const src = read('supabase/functions/off-market-bag-verrijk/index.ts');
    expect(src).not.toMatch(/kadaster-objectinformatie/);
    expect(src).not.toMatch(/api\.kadaster\.nl/i);
    expect(src).not.toMatch(/KADASTER_OBJECTINFORMATIE_API_KEY/);
  });

  it('useEnrichSignaal triggert geen Kadaster-call na succes', () => {
    const src = read('src/hooks/useEnrichSignaal.tsx');
    expect(src).not.toMatch(/kadaster-objectinformatie/);
  });

  it('useOffMarketSignalen.create triggert geen Kadaster-call', () => {
    const src = read('src/hooks/useOffMarketSignalen.tsx');
    expect(src).not.toMatch(/kadaster-objectinformatie/);
  });
});
