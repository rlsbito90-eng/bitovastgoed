import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823020000_ai_value_add_candidates.sql'),
  'utf8',
).toLowerCase();

describe('AI auto-selectie voor value-add signalen', () => {
  it('neemt expliciete transformatie mee', () => {
    expect(migration).toContain("'transformatie'");
    expect(migration).toContain("vergunningtype::text = 'transformatie'");
  });

  it('neemt duidelijke sloop/nieuwbouw-woonontwikkeling mee', () => {
    expect(migration).toMatch(/sloop\[- \]\?nieuwbouw/);
    expect(migration).toContain('bouwen van .*woning');
    expect(migration).toContain('bouwen van .*appartement');
  });

  it('blijft lage boomkap-signalen uitsluiten', () => {
    for (const token of ['houtopstand', 'kapvergunning', 'vellen van', 'kappen van']) {
      expect(migration).toContain(token);
    }
  });

  it('behoudt bestaande splitsing/omzetting/woonvorming-selectie', () => {
    for (const token of ['splitsingsvergunning', 'omzettingsvergunning', 'woonvormingsvergunning']) {
      expect(migration).toContain(token);
    }
  });
});
