import { describe, expect, it } from 'vitest';
import { biedingFromDb, biedingToDb } from './db';

describe('biedkarakter in databasekoppeling', () => {
  it('leest een expliciet formeel bod, los van schriftelijke bron of biedtype', () => {
    const bieding = biedingFromDb({
      id: 'b1', object_id: 'o1', relatie_id: 'r1', offer_type: 'schriftelijk',
      richting: 'van_koper', status: 'ontvangen', bod_karakter: 'formeel',
    });
    expect(bieding.bodKarakter).toBe('formeel');
    expect(bieding.offerType).toBe('schriftelijk');
  });

  it('wijzigt oude biedingen niet stilzwijgend naar formeel', () => {
    const legacy = biedingFromDb({
      id: 'b2', offer_type: 'onvoorwaardelijk', status: 'ontvangen',
    });
    expect(legacy.bodKarakter).toBeNull();
    expect(biedingToDb({ offerType: 'schriftelijk' })).not.toHaveProperty('bod_karakter');
  });

  it('schrijft een expliciet gekozen classificatie, ook bij een correctie naar onbekend', () => {
    expect(biedingToDb({ bodKarakter: 'indicatief' }).bod_karakter).toBe('indicatief');
    expect(biedingToDb({ bodKarakter: 'formeel' }).bod_karakter).toBe('formeel');
    expect(biedingToDb({ bodKarakter: null }).bod_karakter).toBeNull();
  });
});
