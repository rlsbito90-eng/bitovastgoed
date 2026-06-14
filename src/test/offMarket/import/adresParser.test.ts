import { describe, it, expect } from 'vitest';
import { parseAdres, verfijnAdresUitTekst } from '@/lib/offMarket/import/normalize';

describe('parseAdres — meest specifieke adresvariant', () => {
  it('Maaskade 77A-02 3071ND Rotterdam', () => {
    const r = parseAdres('Maaskade 77A-02 3071ND Rotterdam');
    expect(r.adres).toBe('Maaskade 77A-02');
    expect(r.postcode).toBe('3071 ND');
    expect(r.plaats).toBe('Rotterdam');
  });

  it('Nieuwe Binnenweg 256A-01 3021GP Rotterdam', () => {
    const r = parseAdres('Aanvraag Nieuwe Binnenweg 256A-01 3021GP Rotterdam');
    expect(r.adres).toBe('Nieuwe Binnenweg 256A-01');
    expect(r.postcode).toBe('3021 GP');
    expect(r.plaats).toBe('Rotterdam');
  });

  it('John Franklinstraat 56-H in Amsterdam', () => {
    const r = parseAdres('Aanvraag voor splitsingsvergunning John Franklinstraat 56-H in Amsterdam');
    expect(r.adres).toBe('John Franklinstraat 56-H');
    expect(r.plaats).toBe('Amsterdam');
  });

  it('Stuyvesantstraat 35-H in Amsterdam', () => {
    const r = parseAdres('Aanvraag voor splitsingsvergunning Stuyvesantstraat 35-H in Amsterdam');
    expect(r.adres).toBe('Stuyvesantstraat 35-H');
    expect(r.plaats).toBe('Amsterdam');
  });

  it('Valeriusstraat 91 1075EP Amsterdam blijft zonder toevoeging', () => {
    const r = parseAdres('Valeriusstraat 91 1075EP Amsterdam');
    expect(r.adres).toBe('Valeriusstraat 91');
    expect(r.postcode).toBe('1075 EP');
    expect(r.plaats).toBe('Amsterdam');
  });

  it('blijft compatibel met enkelvoudige huisletter (Prinsengracht 263A)', () => {
    const r = parseAdres('Prinsengracht 263A te Amsterdam');
    expect(r.adres).toBe('Prinsengracht 263A');
    expect(r.plaats).toBe('Amsterdam');
  });

  it('Sarphatipark 86-2 (toevoeging zonder huisletter)', () => {
    const r = parseAdres('Omzettingsvergunning Sarphatipark 86-2 1072CV Amsterdam');
    expect(r.adres).toBe('Sarphatipark 86-2');
    expect(r.plaats).toBe('Amsterdam');
  });

  it('postcode zonder spatie + Vondelstraat 70', () => {
    const r = parseAdres('Vergunning aan de Vondelstraat 70, 1054 GD Amsterdam');
    expect(r.adres).toBe('Vondelstraat 70');
    expect(r.postcode).toBe('1054 GD');
    expect(r.plaats).toBe('Amsterdam');
  });
});

describe('verfijnAdresUitTekst', () => {
  it('upgradet Maaskade 77A → Maaskade 77A-02 met postcode/plaats', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Maaskade 77A', postcode: null, plaats: null },
      'Aangevraagde omgevingsvergunning, het intern verbouwen Maaskade 77A-02 3071ND Rotterdam',
    );
    expect(patch).toEqual({
      adres: 'Maaskade 77A-02',
      postcode: '3071 ND',
      plaats: 'Rotterdam',
    });
  });

  it('upgradet ingekorte straatnaam Binnenweg 256A → Nieuwe Binnenweg 256A-01', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Binnenweg 256A', postcode: null, plaats: 'Rotterdam' },
      'Nieuwe Binnenweg 256A-01 3021GP Rotterdam',
    );
    expect(patch?.adres).toBe('Nieuwe Binnenweg 256A-01');
    expect(patch?.postcode).toBe('3021 GP');
    expect(patch?.plaats).toBeUndefined(); // plaats al ingevuld
  });

  it('upgradet Franklinstraat 56 → John Franklinstraat 56-H', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Franklinstraat 56', postcode: null, plaats: null },
      'Aanvraag voor splitsingsvergunning John Franklinstraat 56-H in Amsterdam',
    );
    expect(patch?.adres).toBe('John Franklinstraat 56-H');
    expect(patch?.plaats).toBe('Amsterdam');
  });

  it('upgradet Stuyvesantstraat 35 → Stuyvesantstraat 35-H', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Stuyvesantstraat 35', postcode: null, plaats: 'Amsterdam' },
      'Aanvraag voor splitsingsvergunning Stuyvesantstraat 35-H in Amsterdam',
    );
    expect(patch?.adres).toBe('Stuyvesantstraat 35-H');
  });

  it('laat Valeriusstraat 91 ongemoeid (geen toevoeging in titel)', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Valeriusstraat 91', postcode: '1075 EP', plaats: 'Amsterdam' },
      'Valeriusstraat 91 1075EP Amsterdam',
    );
    expect(patch).toBeNull();
  });

  it('wijzigt geen ander huisnummer', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Maaskade 99', postcode: null, plaats: null },
      'Maaskade 77A-02 3071ND Rotterdam',
    );
    // ander huisnummer → niet overschrijven
    expect(patch?.adres).toBeUndefined();
  });

  it('overschrijft geen al-ingevulde postcode', () => {
    const patch = verfijnAdresUitTekst(
      { adres: 'Maaskade 77A', postcode: '9999 ZZ', plaats: null },
      'Maaskade 77A-02 3071ND Rotterdam',
    );
    expect(patch?.postcode).toBeUndefined();
    expect(patch?.adres).toBe('Maaskade 77A-02');
  });
});
