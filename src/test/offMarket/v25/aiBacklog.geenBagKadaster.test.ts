import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Borging: AI-achterstand-implementatie roept géén BAG of Kadaster aan,
 * en gebruikt géén useEnrichSignaal of triggerBagAutoNaAi.
 */

const BESTANDEN = [
  'src/lib/offMarket/aiBacklog/runner.ts',
  'src/hooks/useAiBacklog.tsx',
  'src/components/admin/AiAchterstandPanel.tsx',
];

const VERBODEN = [
  'off-market-bag-verrijk',
  'off-market-kadaster-check',
  'kadaster-objectinformatie',
  'triggerBagAutoNaAi',
  'useEnrichSignaal',
];

describe('AI-achterstand — geen BAG/Kadaster/cascade', () => {
  for (const pad of BESTANDEN) {
    const inhoud = readFileSync(join(process.cwd(), pad), 'utf8');
    for (const term of VERBODEN) {
      it(`${pad} bevat niet "${term}"`, () => {
        expect(inhoud.includes(term)).toBe(false);
      });
    }
    it(`${pad} stuurt cascade_bag:false (payload alleen in hook)`, () => {
      if (!pad.endsWith('useAiBacklog.tsx')) return;
      expect(inhoud.includes('cascade_bag')).toBe(true);
      expect(inhoud.match(/cascade_bag:\s*false/)).not.toBeNull();
    });
    it(`${pad} stuurt force:false`, () => {
      if (pad.endsWith('runner.ts') || pad.endsWith('AiAchterstandPanel.tsx')) return;
      expect(inhoud.match(/force:\s*false/)).not.toBeNull();
    });
  }
});
