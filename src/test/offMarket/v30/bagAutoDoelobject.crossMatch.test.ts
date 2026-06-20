// V2.5 — Backend auto-doelobject moet kruisgewijs matchen tussen
// signaal-huisletter/-toevoeging en kandidaat-huisletter/-huisnummertoevoeging.
// We testen de algoritme-equivalent (inline gespiegeld vanuit
// supabase/functions/off-market-bag-verrijk/index.ts).
import { describe, it, expect } from 'vitest';
import {
  parseSignaalAdres,
  isRealToevoeging,
} from '@/lib/offMarket/bag/validateDoelobject';

interface PdokDoc {
  id: string;
  huisnummer: number | string;
  huisletter?: string | null;
  huisnummertoevoeging?: string | null;
  postcode?: string | null;
  adresseerbaarobject_id?: string;
  nummeraanduiding_id?: string;
}

interface Signaal {
  adres: string | null;
  postcode: string | null;
  titel?: string | null;
}

function normPc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(c) ? c : null;
}

function docPc(d: PdokDoc): string {
  return String(d.postcode ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Spiegel van de server-side autoselect-logica (V2.5). */
export function autoDoelobjectIndex(
  signaal: Signaal,
  docs: PdokDoc[],
): { primair: PdokDoc[]; nearby: PdokDoc[]; doelobjectIdx: number | null } {
  const parsed = parseSignaalAdres({
    adres: signaal.adres,
    titel: signaal.titel ?? signaal.adres,
    postcode: signaal.postcode,
  });
  const pc = normPc(signaal.postcode);
  const huisnr = parsed.huisnummer;
  const sigLetter = parsed.huisletter ? parsed.huisletter.toUpperCase() : null;
  const sigToev = parsed.toevoeging ? parsed.toevoeging.toUpperCase() : null;
  const sigLetterReal = isRealToevoeging(sigLetter) ? sigLetter : null;
  const sigToevReal = isRealToevoeging(sigToev) ? sigToev : null;

  let primair: PdokDoc[] = docs;
  let nearby: PdokDoc[] = [];
  if (huisnr) {
    const matchesPrimair = (d: PdokDoc) =>
      String(d.huisnummer ?? '') === huisnr && (!pc || docPc(d) === pc);
    primair = docs.filter(matchesPrimair);
    nearby = docs.filter((d) => !matchesPrimair(d));
  }

  let doelobjectIdx: number | null = null;
  if (sigToevReal || sigLetterReal) {
    const seen = new Set<string>();
    const hits: number[] = [];
    for (let i = 0; i < primair.length; i++) {
      const d = primair[i];
      const dLet = (d.huisletter ?? '').toUpperCase();
      const dToe = (d.huisnummertoevoeging ?? '').toUpperCase();
      const ml = !!(sigLetterReal && (dLet === sigLetterReal || dToe === sigLetterReal));
      const mt = !!(sigToevReal && (dToe === sigToevReal || dLet === sigToevReal));
      if (ml || mt) {
        const key = String(d.adresseerbaarobject_id ?? d.nummeraanduiding_id ?? d.id);
        if (!seen.has(key)) {
          seen.add(key);
          hits.push(i);
        }
      }
    }
    if (hits.length === 1) doelobjectIdx = hits[0];
  }
  return { primair, nearby, doelobjectIdx };
}

describe('V2.5 auto-doelobject — kruisgewijs', () => {
  it('signaal-huisletter H matcht kandidaat huisnummertoevoeging H', () => {
    const docs: PdokDoc[] = [
      { id: 'a1', huisnummer: 44, huisnummertoevoeging: 'H', postcode: '1234AB', adresseerbaarobject_id: 'v44h' },
      { id: 'a2', huisnummer: 44, huisnummertoevoeging: '1', postcode: '1234AB', adresseerbaarobject_id: 'v44-1' },
    ];
    const { doelobjectIdx } = autoDoelobjectIndex(
      { adres: 'Teststraat 44-H', postcode: '1234 AB' },
      docs,
    );
    expect(doelobjectIdx).toBe(0);
  });

  it('signaal-toevoeging 1 matcht kandidaat huisletter 1 (omgekeerd)', () => {
    const docs: PdokDoc[] = [
      { id: 'a1', huisnummer: 330, huisletter: '1', postcode: '1074CE', adresseerbaarobject_id: 'v330-1' },
      { id: 'a2', huisnummer: 330, huisletter: '2', postcode: '1074CE', adresseerbaarobject_id: 'v330-2' },
    ];
    const { doelobjectIdx } = autoDoelobjectIndex(
      { adres: 'Teststraat 330-1', postcode: '1074CE' },
      docs,
    );
    expect(doelobjectIdx).toBe(0);
  });

  it('zonder postcode wordt strikt op basis-huisnummer gefilterd', () => {
    const docs: PdokDoc[] = [
      { id: 'a44', huisnummer: 44, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'v44' },
      { id: 'a1', huisnummer: 1, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'v1' },
      { id: 'a3', huisnummer: 3, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'v3' },
    ];
    const { primair, nearby, doelobjectIdx } = autoDoelobjectIndex(
      { adres: 'Teststraat 44-H', postcode: null },
      docs,
    );
    expect(primair.map((d) => d.id)).toEqual(['a44']);
    expect(nearby.map((d) => d.id).sort()).toEqual(['a1', 'a3']);
    expect(doelobjectIdx).toBe(0);
  });

  it('afwijkend huisnummer wordt nearby en nooit auto-doelobject', () => {
    const docs: PdokDoc[] = [
      { id: 'a1', huisnummer: 1, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'v1h' },
    ];
    const { primair, nearby, doelobjectIdx } = autoDoelobjectIndex(
      { adres: 'Teststraat 44-H', postcode: null },
      docs,
    );
    expect(primair).toHaveLength(0);
    expect(nearby).toHaveLength(1);
    expect(doelobjectIdx).toBeNull();
  });

  it('dubbele identieke PDOK-hit wordt gededupliceerd → één unieke treffer → auto', () => {
    const docs: PdokDoc[] = [
      { id: 'a1', huisnummer: 44, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'vbo-x' },
      { id: 'a2', huisnummer: 44, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'vbo-x' },
    ];
    const { doelobjectIdx } = autoDoelobjectIndex(
      { adres: 'Teststraat 44-H', postcode: null },
      docs,
    );
    expect(doelobjectIdx).toBe(0);
  });

  it('meerdere werkelijk verschillende exacte matches → geen auto-doelobject', () => {
    const docs: PdokDoc[] = [
      { id: 'a1', huisnummer: 44, huisnummertoevoeging: 'H', adresseerbaarobject_id: 'vbo-1' },
      { id: 'a2', huisnummer: 44, huisletter: 'H', adresseerbaarobject_id: 'vbo-2' },
    ];
    const { doelobjectIdx } = autoDoelobjectIndex(
      { adres: 'Teststraat 44-H', postcode: null },
      docs,
    );
    expect(doelobjectIdx).toBeNull();
  });
});
