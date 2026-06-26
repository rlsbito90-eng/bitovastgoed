// Tests voor de Kadaster-rechthebbende → brief-geadresseerde mapping in
// `extraheerRechthebbendenUitRecord` en `extraheerEigenaarKandidaten`.
//
// Privacy: alle namen en adressen zijn fictief en bevatten geen echte
// Kadastergegevens.
import { describe, it, expect } from 'vitest';
import {
  extraheerRechthebbendenUitRecord,
  extraheerEigenaarKandidaten,
  bouwBriefPrefill,
  kadasterAdresKandidaten,
} from '@/lib/offMarket/brief';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

function maakSignaal(p: Partial<OffMarketSignaal> = {}): OffMarketSignaal {
  return {
    id: 'sig-x',
    titel: 'Fictiefstraat 1',
    adres: 'Fictiefstraat 1',
    postcode: null,
    plaats: 'Testplaats',
    eigenaarstatus: 'onbekend',
    ...(p as any),
  } as OffMarketSignaal;
}

function maakRecord(p: Partial<KadasterDataRecord>): KadasterDataRecord {
  return {
    id: 'rec-x',
    object_id: null,
    signaal_id: 'sig-x',
    source: 'kadaster_objectinformatie_api',
    mode: 'kadaster',
    product_code: 'rechten' as any,
    status: 'geleverd' as any,
    zoekadres: {},
    fetched_at: new Date().toISOString(),
    koopsom: null, koopjaar: null, koopsom_valuta: null,
    meer_onroerend_goed: null, doelbinding: null,
    bag_bouwjaar: null, bag_oppervlakte: null, bag_object_status: null, bag_gebruiksdoel: null,
    woz_objectnummer: null, woz_oppervlakte: null, woz_oppervlakte_wonen: null,
    woz_oppervlakte_niet_wonen: null, woz_inhoud: null, woz_gebruiksklasse: null,
    feitelijk_gebruik: null, monumentaanduiding: null, actualiteit: null,
    rechten_samenvatting: null, rechthebbende_naam: null, rechthebbende_type: null,
    rechtsoort: null, aandeel: null, kadastrale_aanduiding: null,
    raw_limited: {},
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...p,
  };
}

describe('extraheerRechthebbendenUitRecord — koppelt naam en adres als paar', () => {
  it('twee personen met dezelfde achternaam en verschillende adressen blijven aparte kandidaten', () => {
    const r = maakRecord({
      id: 'rec-multi',
      raw_limited: {
        rechten: [{
          aardRecht: 'Eigendom',
          tenaamstellingen: [
            {
              naamNatuurlijkPersoon: { voornamen: 'Vera', geslachtsnaam: 'Achternaam' },
              adres: { straat: 'Adresstraat A', huisnummer: '1', postcode: '1000AA', plaats: 'Testplaats' },
              gerechtigdAandeel: '1/2',
            },
            {
              naamNatuurlijkPersoon: { voornamen: 'Wessel', geslachtsnaam: 'Achternaam' },
              adres: { straat: 'Adresstraat B', huisnummer: '2', postcode: '2000BB', plaats: 'Anderdorp' },
              gerechtigdAandeel: '1/2',
            },
          ],
        }],
      },
    });
    const rh = extraheerRechthebbendenUitRecord(r);
    const veraStr = rh.find(x => (x.naam ?? '').toLowerCase().includes('vera'));
    const wesselStr = rh.find(x => (x.naam ?? '').toLowerCase().includes('wessel'));
    expect(veraStr).toBeTruthy();
    expect(wesselStr).toBeTruthy();
    expect(veraStr).not.toBe(wesselStr);
    expect(veraStr!.verzendadres).toContain('Adresstraat A');
    expect(veraStr!.verzendadres).toContain('1000AA Testplaats');
    expect(wesselStr!.verzendadres).toContain('Adresstraat B');
    expect(wesselStr!.verzendadres).toContain('2000BB Anderdorp');
    // Stabiele kandidaatId per persoon.
    expect(veraStr!.kandidaatId).toBeTruthy();
    expect(wesselStr!.kandidaatId).toBeTruthy();
    expect(veraStr!.kandidaatId).not.toBe(wesselStr!.kandidaatId);
  });

  it('koppelt naam en sibling-adres binnen dezelfde tenaamstelling via kandidaatId', () => {
    // De adres-knoop staat NIET binnen `naamNatuurlijkPersoon`, maar als
    // sibling `correspondentieadres` van de tenaamstelling. De primaire
    // parser leest dit al via tenaamstelling-niveau; de brede scanner moet
    // dit ook correct koppelen via het ouderpad.
    const r = maakRecord({
      id: 'rec-sibling',
      raw_limited: {
        someContainer: {
          tenaamstellingen: [{
            naamNatuurlijkPersoon: { voornamen: 'Pim', geslachtsnaam: 'Voorbeeld' },
            correspondentieadres: {
              straat: 'Postlaan', huisnummer: '7',
              postcode: '3000CC', plaats: 'Voorbeeldstad',
            },
          }],
        },
      },
    });
    const rh = extraheerRechthebbendenUitRecord(r);
    expect(rh.length).toBe(1);
    expect((rh[0].naam ?? '').toLowerCase()).toContain('voorbeeld');
    expect(rh[0].verzendadres).toContain('Postlaan 7');
    expect(rh[0].verzendadres).toContain('3000CC Voorbeeldstad');
  });

  it('rechthebbende met naam zonder adres blijft als kandidaat met verzendadres = null', () => {
    const r = maakRecord({
      id: 'rec-geen-adres',
      raw_limited: {
        rechten: [{
          aardRecht: 'Eigendom',
          tenaamstellingen: [{
            naamNatuurlijkPersoon: { voornamen: 'Anoniem', geslachtsnaam: 'Naamloos' },
          }],
        }],
      },
    });
    const rh = extraheerRechthebbendenUitRecord(r);
    expect(rh.length).toBe(1);
    expect((rh[0].naam ?? '').toLowerCase()).toContain('naamloos');
    expect(rh[0].verzendadres).toBeNull();
    expect(rh[0].kandidaatId).toBeTruthy();
  });

  it('rechtspersoon wordt niet als persoonsnaam behandeld', () => {
    const r = maakRecord({
      id: 'rec-bv',
      raw_limited: {
        rechten: [{
          aardRecht: 'Eigendom',
          tenaamstellingen: [{
            naamNietNatuurlijkPersoon: { statutaireNaam: 'Voorbeeld Holding B.V.' },
            adres: { straat: 'Bedrijvenlaan', huisnummer: '10', postcode: '4000DD', plaats: 'Bedrijfsstad' },
          }],
        }],
      },
    });
    const rh = extraheerRechthebbendenUitRecord(r);
    expect(rh.length).toBe(1);
    expect(rh[0].bedrijfsnaam).toBe('Voorbeeld Holding B.V.');
    expect(rh[0].naam).toBeNull();
    expect(rh[0].verzendadres).toContain('Bedrijvenlaan 10');
  });
});

describe('extraheerEigenaarKandidaten — signaal blijft voorrang houden', () => {
  it('eigenaar_naam op signaal blijft voorrang houden boven Kadaster-rechthebbende', () => {
    const s = maakSignaal({ eigenaar_naam: 'Signaal Persoon' } as any);
    const r = maakRecord({
      raw_limited: {
        rechten: [{
          aardRecht: 'Eigendom',
          tenaamstellingen: [{
            naamNatuurlijkPersoon: { voornamen: 'Kadaster', geslachtsnaam: 'Persoon' },
            adres: { straat: 'Iets', huisnummer: '1', postcode: '5000EE', plaats: 'Plaats' },
          }],
        }],
      },
    });
    const k = extraheerEigenaarKandidaten(s, [r]);
    expect(k[0].bron).toBe('signaal');
    expect(k[0].naam).toBe('Signaal Persoon');
    // Kadaster-kandidaat komt erbij als losse optie met eigen adres.
    expect(k.length).toBe(2);
    expect(k[1].bron).toBe('kadaster');
    expect(k[1].verzendadres).toContain('5000EE Plaats');
  });

  it('prefill kiest Kadaster-kandidaat met verzendadres als signaal geen adres heeft', () => {
    const s = maakSignaal({
      adres: 'Fictiefstraat 1', plaats: 'Testplaats',
    });
    const r = maakRecord({
      raw_limited: {
        rechten: [{
          aardRecht: 'Eigendom',
          tenaamstellingen: [{
            naamNatuurlijkPersoon: { voornamen: 'Pim', geslachtsnaam: 'Voorbeeld' },
            adres: { straat: 'Postlaan', huisnummer: '7', postcode: '3000CC', plaats: 'Voorbeeldstad' },
          }],
        }],
      },
    });
    const p = bouwBriefPrefill(s, [r]);
    expect((p.eigenaarNaam ?? '').toLowerCase()).toContain('voorbeeld');
    expect(p.verzendadres).toContain('Postlaan 7');
    expect(p.verzendadres).toContain('3000CC Voorbeeldstad');
  });

  it('Kadaster-kandidaat met losse sibling-adresknopen levert verzendadres in de dropdown', () => {
    // Reproduceert het scenario uit de gebruikersmelding: signaal heeft een
    // afgekorte naam, Kadaster levert een vollere naam met sibling-adres.
    // Beide moeten als aparte kandidaten zichtbaar zijn en de Kadaster-
    // kandidaat moet zijn eigen verzendadres meekrijgen.
    const s = maakSignaal({
      eigenaar_naam: 'P.V.B. Voorbeeld',
      adres: 'Fictiefstraat 1',
      plaats: 'Testplaats',
    } as any);
    const r = maakRecord({
      raw_limited: {
        someContainer: {
          tenaamstellingen: [{
            naamNatuurlijkPersoon: {
              voornamen: 'Pieter Voorbeeld Bartholomeus',
              geslachtsnaam: 'Voorbeeldsen',
            },
            correspondentieadres: {
              straat: 'Postlaan', huisnummer: '7',
              postcode: '3000CC', plaats: 'Voorbeeldstad',
            },
          }],
        },
      },
    });
    const k = extraheerEigenaarKandidaten(s, [r]);
    expect(k.length).toBe(2);
    const kad = k.find(x => x.bron === 'kadaster')!;
    expect(kad).toBeTruthy();
    expect(kad.verzendadres).toContain('Postlaan 7');
    expect(kad.verzendadres).toContain('3000CC Voorbeeldstad');
    expect(kad.kandidaatId).toBeTruthy();
  });
});
