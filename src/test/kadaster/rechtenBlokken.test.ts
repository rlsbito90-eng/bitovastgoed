import { describe, it, expect } from 'vitest';
import { mapRechtenBlokken, blokUitOpgeslagenRecord } from '@/lib/kadaster/rechtenBlokken';

describe('mapRechtenBlokken', () => {
  it('herkent meerdere rechtenblokken (eigendom + erfpacht)', () => {
    const data = {
      rechten: [
        {
          rechtsoort: 'Eigendom',
          aandeel: { teller: 1, noemer: 1 },
          rechthebbenden: [{
            natuurlijkPersoon: { volledigeNaam: 'E. Vonk' },
            geboortedatum: '2006-02-24',
            geboorteplaats: 'Rotterdam',
            adres: { straat: 'Sarphatipark', huisnummer: '86',
              huisnummertoevoeging: '2', postcode: '1073EB', plaats: 'Amsterdam' },
            register: { naam: 'Register Hyp4', deel: '92107', nummer: '75' },
          }],
        },
        {
          rechtsoort: 'Erfpacht',
          aandeel: '1/1',
          rechthebbenden: [{
            rechtspersoon: { statutaireNaam: 'Amsterdam Urban Developments B.V.',
              kvkNummer: '12345678', zetel: 'Amsterdam' },
            adres: { straat: 'Keizersgracht', huisnummer: '1', postcode: '1015CJ', plaats: 'Amsterdam' },
          }],
        },
      ],
    };
    const blokken = mapRechtenBlokken(data);
    expect(blokken).toHaveLength(2);
    expect(blokken[0].rechtstype).toBe('Eigendom (recht van)');
    expect(blokken[0].naam).toBe('E. Vonk');
    expect(blokken[0].aandeel).toBe('1/1');
    expect(blokken[0].geboortedatum).toBe('2006-02-24');
    expect(blokken[0].adresRegels.join(' ')).toContain('Sarphatipark');
    expect(blokken[0].postcode).toBe('1073EB');
    expect(blokken[0].registerVerwijzing).toContain('Deel 92107');
    expect(blokken[0].registerVerwijzing).toContain('nummer 75');
    expect(blokken[1].rechtstype).toBe('Erfpacht (recht van)');
    expect(blokken[1].bedrijfsnaam).toBe('Amsterdam Urban Developments B.V.');
    expect(blokken[1].kvkNummer).toBe('12345678');
    expect(blokken[1].zetel).toBe('Amsterdam');
  });

  it('valt terug op platte rechthebbenden-lijst', () => {
    const blokken = mapRechtenBlokken({
      rechthebbenden: [{ naam: 'A. Pietersen', aardRecht: 'Eigendom', breukdeel: { teller: 1, noemer: 2 } }],
    });
    expect(blokken).toHaveLength(1);
    expect(blokken[0].rechtstype).toBe('Eigendom (recht van)');
    expect(blokken[0].aandeel).toBe('1/2');
  });

  it('crasht niet op lege/onbekende input', () => {
    expect(mapRechtenBlokken(null)).toEqual([]);
    expect(mapRechtenBlokken({})).toEqual([]);
    expect(mapRechtenBlokken({ rechten: 'kapot' })).toEqual([]);
  });

  it('blokUitOpgeslagenRecord maakt 1 blok uit row-velden', () => {
    const b = blokUitOpgeslagenRecord({
      rechthebbende_naam: 'Voorbeeld B.V.',
      rechthebbende_type: 'rechtspersoon',
      rechtsoort: 'Erfpacht',
      aandeel: '1/1',
      kadastrale_aanduiding: 'AMS00-Q-9999',
    });
    expect(b).not.toBeNull();
    expect(b!.bedrijfsnaam).toBe('Voorbeeld B.V.');
    expect(b!.rechtstype).toBe('Erfpacht (recht van)');
    expect(b!.kadastraleAanduiding).toBe('AMS00-Q-9999');
  });
});
