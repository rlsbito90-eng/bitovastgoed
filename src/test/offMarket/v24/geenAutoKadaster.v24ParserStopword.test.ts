// V2.4 — parser/stopword-fix introduceert geen Kadaster-aanvraag.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
function read(rel: string) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

describe('V2.4 — parser stopword fix roept geen Kadaster aan', () => {
  it('validateDoelobject bevat geen Kadaster-referenties', () => {
    const src = read('src/lib/offMarket/bag/validateDoelobject.ts');
    expect(src).not.toMatch(/kadaster/i);
  });
  it('BAG-edge-function bevat geen betaalde Kadaster-aanroep', () => {
    const src = read('supabase/functions/off-market-bag-verrijk/index.ts');
    expect(src).not.toMatch(/kadaster-objectinformatie/);
    expect(src).not.toMatch(/api\.kadaster\.nl/i);
  });
});
