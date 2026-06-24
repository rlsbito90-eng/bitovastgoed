// V38 — Geen referenties naar BAG/AI/GEO/Kadaster in nieuwe Fase 3-bestanden.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BESTANDEN = [
  'src/lib/offMarket/acquisitie/adreslabel.ts',
  'src/components/offmarket/acquisitie/GecombineerdeAdreslabelsPDF.tsx',
  'src/components/offmarket/acquisitie/AdreslabelsPdfDialog.tsx',
  'src/components/offmarket/acquisitie/MarkeerBulkDialog.tsx',
];

const VERBODEN = [
  /kadaster-/i,
  /pdok/i,
  /bag-verrijk/i,
  /\bAI-?gateway/i,
  /off-market-ai-/i,
  /off-market-geo-/i,
  /off-market-bag-/i,
];

describe('v38 — geen Kadaster/BAG/AI/GEO references', () => {
  for (const rel of BESTANDEN) {
    it(`${rel} bevat geen verboden imports/calls`, () => {
      const tekst = readFileSync(resolve(process.cwd(), rel), 'utf8');
      for (const re of VERBODEN) {
        expect(re.test(tekst), `Verboden patroon ${re} in ${rel}`).toBe(false);
      }
    });
  }
});
