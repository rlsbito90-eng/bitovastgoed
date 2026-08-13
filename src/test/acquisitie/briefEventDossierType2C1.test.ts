import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const bron = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/offMarket/brieven/events.ts'),
  'utf8',
);

describe('BUILD 2.0C.1 — brief-event dossiercompatibiliteit', () => {
  it('leidt dossier_type af voor bestaande Off-Market-callers', () => {
    expect(bron).toContain("dossier_type: vastgoedkansId ? 'vastgoedkans' : 'off_market_signaal'");
  });

  it('ondersteunt Vastgoedkans zonder fake signaal-ID', () => {
    expect(bron).toContain('vastgoedkans_id?: string | null');
    expect(bron).toContain('vastgoedkans_id: vastgoedkansId');
  });

  it('weigert nul of twee dossierbronnen fail-soft', () => {
    expect(bron).toContain('exact één dossierbron is verplicht');
  });
});
