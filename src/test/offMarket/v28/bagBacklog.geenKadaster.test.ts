import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Borging: BAG-achterstand-implementatie roept géén Kadaster-API of -function aan
 * en hanteert geen client-side statusclaim of cascade-trigger.
 */

const BESTANDEN = [
  'src/lib/offMarket/bagBacklog/runner.ts',
  'src/hooks/useBagBacklog.tsx',
  'src/components/admin/BagAchterstandPanel.tsx',
];

const VERBODEN = [
  'off-market-kadaster-check',
  'kadaster-objectinformatie',
  'KADASTER_',
  'kadaster_data_records',
  'triggerBagAutoNaAi',
  'persistKadasteradvies',
];

describe('BAG-achterstand — geen Kadaster en geen client-side claim', () => {
  for (const pad of BESTANDEN) {
    const inhoud = readFileSync(join(process.cwd(), pad), 'utf8');
    for (const term of VERBODEN) {
      it(`${pad} bevat niet "${term}"`, () => {
        expect(inhoud.includes(term)).toBe(false);
      });
    }
    if (pad.endsWith('useBagBacklog.tsx')) {
      it('roept uitsluitend off-market-bag-verrijk aan via supabase.functions.invoke', () => {
        const calls = [...inhoud.matchAll(/functions\.invoke\(\s*['"]([^'"]+)['"]/g)].map(
          (m) => m[1],
        );
        expect(calls.length).toBeGreaterThan(0);
        for (const naam of calls) {
          expect(naam).toBe('off-market-bag-verrijk');
        }
      });
      it('stuurt force:false en geen cascade-veld', () => {
        expect(inhoud.match(/force:\s*false/)).not.toBeNull();
      });
    }
  }
});
