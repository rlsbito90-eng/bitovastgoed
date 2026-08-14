import { describe, expect, it } from 'vitest';
import { bouwKadasterEigenaarVoorstellen } from '@/lib/kadaster/eigenaarInterpretatie';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

function enthovenRecord(): KadasterDataRecord {
  return {
    id: 'edcea9a2-7d27-4fc6-afdd-d1f4a59cde66',
    object_id: null,
    signaal_id: null,
    vastgoedkans_id: '0bf7da4b-b47d-488a-b674-93a86a544cc9',
    source: 'kadaster',
    mode: 'kadaster',
    product_code: 'rechten',
    status: 'geleverd',
    zoekadres: {},
    fetched_at: '2026-08-13T19:26:13.933Z',
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
    rechthebbende_naam: 'Enthoven',
    rechthebbende_type: null,
    rechtsoort: null,
    aandeel: null,
    kadastrale_aanduiding: null,
    raw_limited: {
      rechten: {
        blokken: [{
          naam: null,
          persons: [{ naam: 'Enthoven', aandeel: null, voornamen: 'Albertina Wilhelmina' }],
          entities: [],
          aanduiding: { kadastraleAanduiding: 'Amsterdam M 5368' },
          omschrijving: 'Eigendom (recht van)',
          aandeelInRecht: '1/1',
        }],
      },
    },
    created_at: '2026-08-13T19:26:13.933Z',
    updated_at: '2026-08-13T19:26:13.933Z',
  };
}

describe('BUILD 2.0B — natuurlijke persoon uit Kadaster Rechten', () => {
  it('behandelt naam naast voornamen als geslachtsnaam', () => {
    const voorstellen = bouwKadasterEigenaarVoorstellen([enthovenRecord()]);
    expect(voorstellen).toHaveLength(1);
    expect(voorstellen[0]).toMatchObject({
      naam: 'Albertina Wilhelmina Enthoven',
      voornamen: 'Albertina Wilhelmina',
      voorletters: 'A.W.',
      persoonType: 'natuurlijk',
      aandeel: '1/1',
    });
  });
});
