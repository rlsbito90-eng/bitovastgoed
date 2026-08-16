import { describe, expect, it } from 'vitest';
import type { KadasterRechtenBlok } from '@/lib/kadaster/rechtenBlokken';
import {
  maakKadasterEigenaarVoorstel,
  pasKadasterVoorstelToe,
  type EigenaarVoorstelForm,
} from './kadasterEigenaarVoorstel';

function blok(overrides: Partial<KadasterRechtenBlok>): KadasterRechtenBlok {
  return {
    id: 'x', rechtstype: 'Eigendom (recht van)', aandeel: '1/1',
    naam: null, bedrijfsnaam: null, persoonType: null,
    geboortedatum: null, geboorteplaats: null,
    adresRegels: [], postcode: null, plaats: null, zetel: null,
    kvkNummer: null, registerVerwijzing: null, kadastraleAanduiding: null,
    bron: 'json',
    ...overrides,
  };
}

const leegForm: EigenaarVoorstelForm = {
  eigenaarstatus: 'te_onderzoeken',
  eigenaar_naam: '',
  eigenaar_type: '',
  eigenaar_bedrijfsnaam: '',
  eigenaar_kvk: '',
  eigenaar_straat_huisnummer: '',
  eigenaar_postcode: '',
  eigenaar_plaats: '',
  eigenaar_verzendadres: '',
  eigenaar_rechtstype: '',
  eigenaar_aandeel: '',
  eigenaar_rechtssituatie: '',
  bloot_eigenaar: null,
  kadastrale_aanduiding: '',
  eigenaarbron: '',
};

describe('Kadaster eigenaarvoorstel — rechtenbewust', () => {
  it('zet volle eigendom van een BV 1/1 om naar de primaire acquisitiegeadresseerde', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({
        persoonType: 'rechtspersoon',
        bedrijfsnaam: 'J.H.F. Schopman en Zonen B.V.',
        kvkNummer: '33006758',
        aandeel: '1/1',
        adresRegels: ['Sarphatistraat 370'],
        postcode: '1018GW',
        plaats: 'AMSTERDAM',
      }),
    ]);

    expect(voorstel).toMatchObject({
      status: 'eenduidig',
      controleNodig: false,
      eigenaarstatus: 'gevonden',
      eigenaar_type: 'bv',
      eigenaar_bedrijfsnaam: 'J.H.F. Schopman en Zonen B.V.',
      eigenaar_kvk: '33006758',
      eigenaar_straat_huisnummer: 'Sarphatistraat 370',
      eigenaar_postcode: '1018GW',
      eigenaar_plaats: 'AMSTERDAM',
      eigenaar_rechtssituatie: 'volle_eigendom',
      eigenaar_aandeel: '1/1',
      eigenaarbron: 'kadaster',
      bloot_eigenaar: null,
    });
  });

  it('kiest bij erfpacht de erfpachter en bewaart de bloot eigenaar secundair', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({
        id: 'eigendom',
        rechtstype: 'Eigendom (recht van)',
        persoonType: 'rechtspersoon',
        bedrijfsnaam: 'Gemeente Amsterdam',
        kvkNummer: '34366966',
        aandeel: '1/1',
        adresRegels: ['Amstel 1'],
        postcode: '1011PN',
        plaats: 'AMSTERDAM',
      }),
      blok({
        id: 'erfpacht',
        rechtstype: 'Erfpacht (recht van)',
        persoonType: 'rechtspersoon',
        bedrijfsnaam: 'Paul Vismans Projecten Beheer Twee B.V.',
        kvkNummer: '75653095',
        aandeel: '1/1',
        adresRegels: ['Herengracht 372'],
        postcode: '1016CH',
        plaats: 'AMSTERDAM',
      }),
    ]);

    expect(voorstel).toMatchObject({
      status: 'eenduidig',
      controleNodig: false,
      eigenaar_type: 'bv',
      eigenaar_bedrijfsnaam: 'Paul Vismans Projecten Beheer Twee B.V.',
      eigenaar_kvk: '75653095',
      eigenaar_straat_huisnummer: 'Herengracht 372',
      eigenaar_postcode: '1016CH',
      eigenaar_plaats: 'AMSTERDAM',
      eigenaar_rechtssituatie: 'erfpacht',
      eigenaar_aandeel: '1/1',
      bloot_eigenaar: {
        bedrijfsnaam: 'Gemeente Amsterdam',
        kvk: '34366966',
        aandeel: '1/1',
      },
    });
  });

  it('stuurt meerdere primaire erfpachters naar controle in plaats van stil te kiezen', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({
        id: 'a', rechtstype: 'Erfpacht (recht van)', persoonType: 'natuurlijk',
        naam: 'Jan Jansen', adresRegels: ['Straat 1'], postcode: '1011AA', plaats: 'Amsterdam',
      }),
      blok({
        id: 'b', rechtstype: 'Erfpacht (recht van)', persoonType: 'natuurlijk',
        naam: 'Piet Pieters', adresRegels: ['Straat 2'], postcode: '1011AB', plaats: 'Amsterdam',
      }),
    ]);

    expect(voorstel.status).toBe('ambigu');
    expect(voorstel.controleNodig).toBe(true);
    expect(voorstel.controleReden).toContain('Meerdere rechthebbenden');
  });

  it('markeert een eenduidige rechthebbende zonder compleet adres voor controle', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({
        persoonType: 'rechtspersoon', bedrijfsnaam: 'Voorbeeld B.V.',
        kvkNummer: '12345678', adresRegels: ['Voorbeeldstraat 1'],
        postcode: null, plaats: 'Amsterdam',
      }),
    ]);

    expect(voorstel).toMatchObject({
      status: 'eenduidig',
      controleNodig: true,
      eigenaar_bedrijfsnaam: 'Voorbeeld B.V.',
      eigenaar_rechtssituatie: 'volle_eigendom',
    });
    expect(voorstel.controleReden).toContain('Adres');
  });

  it.each([
    ['Bito Vastgoed B.V.', 'bv'],
    ['Stichting Woonfonds', 'stichting'],
    ['VvE Parklaan 10', 'vve'],
    ['Gemeente Amsterdam', 'overheid'],
  ] as const)('herkent duidelijke rechtspersoon %s als %s', (naam, type) => {
    expect(maakKadasterEigenaarVoorstel([
      blok({
        persoonType: 'rechtspersoon', bedrijfsnaam: naam,
        adresRegels: ['Voorbeeldstraat 1'], postcode: '1011AA', plaats: 'Amsterdam',
      }),
    ])).toMatchObject({ status: 'eenduidig', eigenaar_type: type, eigenaar_bedrijfsnaam: naam });
  });

  it('overschrijft bestaande handmatige velden niet bij toepassen van een voorstel', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({
        persoonType: 'rechtspersoon', bedrijfsnaam: 'Kadaster B.V.', kvkNummer: '12345678',
        adresRegels: ['Kadasterstraat 1'], postcode: '1011AA', plaats: 'Amsterdam',
      }),
    ]);
    const resultaat = pasKadasterVoorstelToe({
      ...leegForm,
      eigenaar_bedrijfsnaam: 'Handmatig Vastgoed B.V.',
      eigenaar_kvk: '87654321',
      eigenaar_straat_huisnummer: 'Handmatig 10',
      eigenaarbron: 'netwerk',
    }, voorstel);

    expect(resultaat.eigenaar_bedrijfsnaam).toBe('Handmatig Vastgoed B.V.');
    expect(resultaat.eigenaar_kvk).toBe('87654321');
    expect(resultaat.eigenaar_straat_huisnummer).toBe('Handmatig 10');
    expect(resultaat.eigenaarbron).toBe('netwerk');
    expect(resultaat.eigenaarstatus).toBe('gevonden');
  });
});
