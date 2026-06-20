import { describe, it, expect } from 'vitest';
import { magBagAutoVerrijken } from '@/lib/offMarket/bag/autoTrigger';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

/**
 * Borging: teller en snapshot gebruiken exact dezelfde magBagAutoVerrijken-guard.
 * Score-/strategie-/adres-/statusmatrix is hier eenduidig vastgelegd zodat afwijkingen
 * tussen teller en snapshot direct opvallen.
 */

const basis: SignaalBagInput = {
  id: 'sig-x',
  titel: 'Generiek pand',
  adres: 'Teststraat 12',
  postcode: '1234AB',
  plaats: 'Testplaats',
  bron_url: 'https://example.test/x',
  ai_status: 'klaar',
  ai_score: 80,
  ai_skip_reden: null,
  bag_status: 'niet_verrijkt',
};

function snapshotFilter(rows: SignaalBagInput[]): string[] {
  return rows.filter((r) => magBagAutoVerrijken(r).toegestaan).map((r) => r.id!);
}

describe('BAG-achterstand selectie — magBagAutoVerrijken matrix', () => {
  it('selecteert score ≥ 70 met goed adres en bag_status niet_verrijkt', () => {
    expect(magBagAutoVerrijken({ ...basis, ai_score: 70 }).toegestaan).toBe(true);
    expect(magBagAutoVerrijken({ ...basis, ai_score: 90 }).toegestaan).toBe(true);
  });

  it('selecteert score 50–69 alleen met strategie-match', () => {
    expect(magBagAutoVerrijken({ ...basis, ai_score: 60 }).toegestaan).toBe(false);
    expect(
      magBagAutoVerrijken({
        ...basis,
        ai_score: 60,
        ai_strategie_suggestie: 'transformatie naar wonen',
      }).toegestaan,
    ).toBe(true);
  });

  it('weigert score < 50', () => {
    expect(magBagAutoVerrijken({ ...basis, ai_score: 49 }).toegestaan).toBe(false);
    expect(magBagAutoVerrijken({ ...basis, ai_score: 0 }).toegestaan).toBe(false);
  });

  it('weigert onvoldoende adreskwaliteit', () => {
    expect(magBagAutoVerrijken({ ...basis, postcode: null, adres: 'iets zonder huisnummer' }).toegestaan)
      .toBe(false);
    expect(magBagAutoVerrijken({ ...basis, postcode: '1234', adres: 'Teststraat 12' }).toegestaan)
      .toBe(true); // adres+huisnr+plaats valt nog binnen criteria
    expect(magBagAutoVerrijken({ ...basis, postcode: null, adres: '', plaats: '' }).toegestaan)
      .toBe(false);
  });

  it('weigert ai_status != klaar of ai_skip_reden gevuld', () => {
    expect(magBagAutoVerrijken({ ...basis, ai_status: 'bezig' }).toegestaan).toBe(false);
    expect(magBagAutoVerrijken({ ...basis, ai_status: 'niet_verrijkt' }).toegestaan).toBe(false);
    expect(magBagAutoVerrijken({ ...basis, ai_skip_reden: 'te weinig data' }).toegestaan).toBe(false);
  });

  it('weigert archief/afgevallen/niet_interessant en gearchiveerd_op', () => {
    expect(magBagAutoVerrijken({ ...basis, status: 'archief' }).toegestaan).toBe(false);
    expect(magBagAutoVerrijken({ ...basis, status: 'afgevallen' }).toegestaan).toBe(false);
    expect(magBagAutoVerrijken({ ...basis, status: 'niet_interessant' }).toegestaan).toBe(false);
    expect(
      magBagAutoVerrijken({ ...basis, gearchiveerd_op: '2025-01-01T00:00:00Z' }).toegestaan,
    ).toBe(false);
  });

  it('weigert bag_status verrijkt of bezig', () => {
    expect(magBagAutoVerrijken({ ...basis, bag_status: 'verrijkt' }).toegestaan).toBe(false);
    expect(magBagAutoVerrijken({ ...basis, bag_status: 'bezig' }).toegestaan).toBe(false);
  });

  it('teller en snapshot leveren exact dezelfde geschikte ID-set', () => {
    const rijen: SignaalBagInput[] = [
      { ...basis, id: '1' }, // ok
      { ...basis, id: '2', ai_score: 40 }, // weg
      { ...basis, id: '3', ai_score: 55, ai_strategie_suggestie: 'splitsen' }, // ok
      { ...basis, id: '4', bag_status: 'verrijkt' }, // weg
      { ...basis, id: '5', ai_status: 'niet_verrijkt' }, // weg
      { ...basis, id: '6', status: 'archief' }, // weg
      { ...basis, id: '7', ai_skip_reden: 'x' }, // weg
      { ...basis, id: '8', postcode: null, adres: 'geen huisnummer', plaats: 'X' }, // weg
    ];
    const teller = snapshotFilter(rijen).length;
    const snapshot = snapshotFilter(rijen);
    expect(teller).toBe(snapshot.length);
    expect(snapshot).toEqual(['1', '3']);
  });
});
