import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/bito-ical-feed/index.ts'),
  'utf8',
);

describe('iCal feed user scope', () => {
  it('weigert een feedtoken zonder gebruiker', () => {
    expect(bron).toContain('if (!tokenRow.gebruiker_id)');
    expect(bron).toContain("return new Response('Feedtoken heeft geen gebruiker', { status: 403 })");
  });

  it('scope centrale taken op de gebruiker van het feedtoken', () => {
    expect(bron).toContain('const feedUserId = tokenRow.gebruiker_id');
    expect(bron).toContain('owner_user_id, source_kind, source_id, source_slot');
    expect(bron).toContain(".eq('owner_user_id', feedUserId)");
  });

  it('bouwt canonical dedupe uitsluitend uit de user-scoped taakset', () => {
    expect(bron).toContain('const canonicalSourceSlots = new Set');
    expect(bron).toContain('De set bevat uitsluitend taken van feedUserId');
  });
});
