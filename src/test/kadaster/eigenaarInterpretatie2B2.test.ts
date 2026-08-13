import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Relatie } from '@/data/mock-data';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import { bouwKadasterEigenaarVoorstellen, vindCrmMatches } from '@/lib/kadaster/eigenaarInterpretatie';

const basis = {
  object_id: null,
  signaal_id: null,
  vastgoedkans_id: 'kans-1',
  source: 'kadaster_objectinformatie_api',
  mode: 'kadaster',
  product_code: 'rechten',
  status: 'geleverd',
  zoekadres: { waarde: '1015AG 150 H' },
  fetched_at: '2026-08-13T19:26:00Z',
  koopsom: null,
  koopjaar: null,
  koopsom_valuta: null,
  meer_onroerend_goed: null,
  doelbinding: null,
  bag_bouwjaar: null,
  bag_oppervlakte: null,
  bag_object_status: null,
  bag_gebruiksdoel: null,
  woz_objectnummer: null,
  woz_oppervlakte: null,
  woz_oppervlakte_wonen: null,
  woz_oppervlakte_niet_wonen: null,
  woz_inhoud: null,
  woz_gebruiksklasse: null,
  feitelijk_gebruik: null,
  monumentaanduiding: null,
  actualiteit: null,
  rechten_samenvatting: null,
  rechtsoort: 'Eigendom (recht van)',
  aandeel: '1/1',
  kadastrale_aanduiding: null,
  created_at: '2026-08-13T19:26:00Z',
  updated_at: '2026-08-13T19:26:00Z',
} as const;

describe('BUILD 2.0B.2 — eigendomsinterpretatie', () => {
  it('haalt natuurlijke-persoonsnaam, voorletters en adres uit opgeslagen gestructureerde Rechten-data', () => {
    const records = [{
      ...basis,
      id: 'r1',
      rechthebbende_naam: 'Jan Pieter Enthoven',
      rechthebbende_type: 'natuurlijk persoon',
      raw_limited: { rechten: { blokken: [{
        rechtsoort: 'Eigendom (recht van)',
        aandeel: '1/1',
        persons: [{ persoon: {
          voornamen: 'Jan Pieter',
          geslachtsnaam: 'Enthoven',
          woonadres: { straat: 'Singel', huisnummer: '10', postcode: '1015AG', plaats: 'Amsterdam' },
        } }],
      }] } },
    }] as unknown as KadasterDataRecord[];

    expect(bouwKadasterEigenaarVoorstellen(records)[0]).toMatchObject({
      naam: 'Jan Pieter Enthoven',
      persoonType: 'natuurlijk',
      voornamen: 'Jan Pieter',
      voorletters: 'J.P.',
      adresRegels: ['Singel 10'],
      postcode: '1015AG',
      plaats: 'Amsterdam',
    });
  });

  it('haalt bedrijfsnaam, KvK en vestigingsadres uit een rechtspersoon en matcht exact op KvK', () => {
    const records = [{
      ...basis,
      id: 'r2',
      rechthebbende_naam: 'Voorbeeld Vastgoed B.V.',
      rechthebbende_type: 'rechtspersoon',
      raw_limited: { rechten: { blokken: [{
        rechtsoort: 'Eigendom (recht van)',
        entities: [{ onderneming: {
          statutaireNaam: 'Voorbeeld Vastgoed B.V.',
          kvkNummer: '12345678',
          vestigingsadres: { straat: 'Herengracht', huisnummer: '1', postcode: '1015BA', plaats: 'Amsterdam' },
        } }],
      }] } },
    }] as unknown as KadasterDataRecord[];

    const voorstel = bouwKadasterEigenaarVoorstellen(records)[0];
    expect(voorstel).toMatchObject({
      bedrijfsnaam: 'Voorbeeld Vastgoed B.V.',
      persoonType: 'rechtspersoon',
      kvkNummer: '12345678',
      adresRegels: ['Herengracht 1'],
    });

    const relatie = {
      id: 'rel-1', bedrijfsnaam: 'Voorbeeld Vastgoed BV', contactpersoon: '', type: 'eigenaar',
      telefoon: '', email: '', regio: [], assetClasses: [], ndaGetekend: false,
      bronRelatie: '', leadStatus: 'koud', laatsteContact: '', kvkNummer: '12345678',
    } as Relatie;
    expect(vindCrmMatches(voorstel, [relatie])[0]).toMatchObject({ score: 100, reden: 'kvk_exact' });
  });

  it('maakt van een nieuwe Kadaster-eigenaar geen CRM-relatie via de UI', () => {
    const bron = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');
    expect(bron).toContain('Eigenaar & CRM-match');
    expect(bron).toContain('bouwKadasterEigenaarVoorstellen');
    expect(bron).toContain('vindCrmMatches');
    expect(bron).not.toContain('QuickCreateRelationDialog');
    expect(bron).not.toContain('Nieuwe relatie aanmaken');
  });
});
