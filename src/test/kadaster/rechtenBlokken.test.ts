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

  it('herkent persons/entities binnen rechten-items (Kadaster API shape)', () => {
    const data = {
      rechten: [{
        omschrijving: 'Eigendom',
        aandeelInRecht: { teller: 1, noemer: 1 },
        persons: [{ volledigeNaam: 'J. de Vries', geboortedatum: '1980-01-01' }],
        entities: [{ statutaireNaam: 'Bito Holding B.V.', kvkNummer: '99887766' }],
      }],
    };
    const blokken = mapRechtenBlokken(data);
    expect(blokken.length).toBeGreaterThanOrEqual(2);
    expect(blokken.find(b => b.naam === 'J. de Vries')).toBeTruthy();
    expect(blokken.find(b => b.bedrijfsnaam === 'Bito Holding B.V.')).toBeTruthy();
  });

  it('herkent persist-shape met blokken-array (raw_limited.rechten)', () => {
    const persisted = {
      aantal: 1, gebruikte_array: 'rechten', top_level_keys: ['rechten'], arrays: {},
      blokken: [{
        omschrijving: 'Eigendom',
        aandeelInRecht: '1/1',
        persons: [{ volledigeNaam: 'A. Jansen' }],
      }],
    };
    const blokken = mapRechtenBlokken(persisted);
    expect(blokken).toHaveLength(1);
    expect(blokken[0].naam).toBe('A. Jansen');
    expect(blokken[0].rechtstype).toBe('Eigendom (recht van)');
    expect(blokken[0].aandeel).toBe('1/1');
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

  it('herkent live Kadaster API shape met naam/omschrijving/documentGebaseerdOp', () => {
    const data = {
      rechten: [{
        naam: 'Eigendom',
        omschrijving: 'Eigendom (recht van)',
        identifier: 'NL.IMKAD.Recht.123',
        aandeelInRecht: '1/1',
        aanduiding: 'AMS00-Q-1234',
        documentGebaseerdOp: { naam: 'Register Hyp4', deel: '92107', nummer: '75' },
        persons: [{
          volledigeNaam: 'E. Vonk',
          geboortedatum: '2006-02-24',
          geboorteplaats: 'Rotterdam',
          adres: { straat: 'Sarphatipark', huisnummer: '86', postcode: '1073EB', plaats: 'Amsterdam' },
        }],
        entities: [{
          statutaireNaam: 'Bito Holding B.V.',
          kvkNummer: '99887766',
          zetel: 'Amsterdam',
        }],
      }],
    };
    const blokken = mapRechtenBlokken(data);
    expect(blokken.length).toBe(2);
    const persoon = blokken.find(b => b.naam === 'E. Vonk')!;
    expect(persoon).toBeTruthy();
    expect(persoon.rechtstype).toBe('Eigendom (recht van)');
    expect(persoon.aandeel).toBe('1/1');
    expect(persoon.geboortedatum).toBe('2006-02-24');
    expect(persoon.adresRegels.join(' ')).toContain('Sarphatipark');
    expect(persoon.registerVerwijzing).toContain('Deel 92107');
    const bedrijf = blokken.find(b => b.bedrijfsnaam === 'Bito Holding B.V.')!;
    expect(bedrijf).toBeTruthy();
    expect(bedrijf.kvkNummer).toBe('99887766');
    expect(bedrijf.zetel).toBe('Amsterdam');
  });

  it('persist-shape met alleen naam (zonder omschrijving) leidt rechtstype af', () => {
    const persisted = {
      blokken: [{
        naam: 'Erfpacht',
        aandeelInRecht: '1/2',
        persons: [{ volledigeNaam: 'P. Persoon' }],
      }],
    };
    const blokken = mapRechtenBlokken(persisted);
    expect(blokken).toHaveLength(1);
    expect(blokken[0].rechtstype).toBe('Erfpacht (recht van)');
    expect(blokken[0].aandeel).toBe('1/2');
    expect(blokken[0].naam).toBe('P. Persoon');
  });
});

