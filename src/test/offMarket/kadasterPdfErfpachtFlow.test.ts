import { describe, expect, it } from 'vitest';
import { mapRechtenBlokken } from '@/lib/kadaster/rechtenBlokken';
import { bepaalRechtenbewusteEigenaar } from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';
import { parseKadasterPdfRechten } from '@/lib/offMarket/acquisitie/kadasterPdfRechtenParser';

function pdfVerrijkteRechten() {
  return {
    blokken: [
      {
        omschrijving: 'Eigendom (recht van)',
        aandeelInRecht: '1/1',
        persons: [],
        entities: [{
          naam: 'Gemeente Amsterdam',
          kvk: '34366966',
          adres: {
            straat: 'Amstel',
            huisnummer: '1',
            postcode: '1011 PN',
            plaats: 'Amsterdam',
          },
        }],
      },
      {
        omschrijving: 'Erfpacht (recht van)',
        aandeelInRecht: '1/1',
        persons: [],
        entities: [{
          naam: 'Paul Vismans Projecten Beheer Twee B.V.',
          kvk: '75653095',
          adres: {
            straat: 'Herengracht',
            huisnummer: '372',
            postcode: '1016 CH',
            plaats: 'Amsterdam',
          },
        }],
      },
    ],
  };
}

const echteErfpachtPdfTekst = `
Rechten
Eigendom (recht van)
Aandeel 1/1
Naam Gemeente Amsterdam
Adres Amstel 1
1011PN
AMSTERDAM
Postbus -
Zetel AMSTERDAM
KvK-nummer 34366966 (Bron: Handelsregister)
Overige rechten
Erfpacht (recht van)
Aandeel 1/1
Naam Paul Vismans Projecten Beheer Twee B.V.
Adres Herengracht 372
1016CH
AMSTERDAM
Postbus -
Zetel AMSTERDAM
KvK-nummer 75653095 (Bron: Handelsregister)
Gebaseerd op Register Hyp4 Deel 76940 nummer 52
Bijzonderheden
Aantekeningen Er zijn aantekeningen bekend
`;

describe('Kadaster PDF-verrijking — erfpacht', () => {
  it('behoudt eigendom en erfpacht als afzonderlijke rechtenblokken', () => {
    const blokken = mapRechtenBlokken(pdfVerrijkteRechten());
    expect(blokken).toHaveLength(2);
    expect(blokken.map((b) => b.rechtstype)).toEqual([
      'Eigendom (recht van)',
      'Erfpacht (recht van)',
    ]);
  });

  it('kiest de erfpachter als primaire acquisitiepartij en eigendom als bloot eigenaar', () => {
    const blokken = mapRechtenBlokken(pdfVerrijkteRechten());
    const uitkomst = bepaalRechtenbewusteEigenaar(blokken);

    expect(uitkomst.status).toBe('eenduidig');
    expect(uitkomst.rechtssituatie).toBe('erfpacht');
    expect(uitkomst.voorstel.eigenaar_bedrijfsnaam).toBe('Paul Vismans Projecten Beheer Twee B.V.');
    expect(uitkomst.voorstel.eigenaar_kvk).toBe('75653095');
    expect(uitkomst.straatHuisnummer).toBe('Herengracht 372');
    expect(uitkomst.postcode).toBe('1016 CH');
    expect(uitkomst.plaats).toBe('Amsterdam');
    expect(uitkomst.adresCompleet).toBe(true);
    expect(uitkomst.blootEigenaar?.naam).toBe('Gemeente Amsterdam');
    expect(uitkomst.blootEigenaar?.kvk).toBe('34366966');
  });

  it('parseert de echte Kadaster-PDF tekst ook wanneer unpdf regels tot spaties samenvoegt', () => {
    const rechten = parseKadasterPdfRechten(echteErfpachtPdfTekst.replace(/\n/g, ' '));

    expect(rechten).toHaveLength(2);
    expect(rechten[0]).toMatchObject({
      rechtssituatie: 'volle_eigendom',
      naam: 'Gemeente Amsterdam',
      kvk: '34366966',
      straatHuisnummer: 'Amstel 1',
      postcode: '1011 PN',
      plaats: 'AMSTERDAM',
    });
    expect(rechten[1]).toMatchObject({
      rechtssituatie: 'erfpacht',
      naam: 'Paul Vismans Projecten Beheer Twee B.V.',
      kvk: '75653095',
      straatHuisnummer: 'Herengracht 372',
      postcode: '1016 CH',
      plaats: 'AMSTERDAM',
      aandeel: '1/1',
    });
  });

  it('behoudt de erfpachter als kandidaat als alleen het adres niet uitleesbaar is', () => {
    const rechten = parseKadasterPdfRechten(`
      Rechten Eigendom (recht van) Aandeel 1/1 Naam Gemeente Amsterdam KvK-nummer 34366966
      Overige rechten Erfpacht (recht van) Aandeel 1/1 Naam Paul Vismans Projecten Beheer Twee B.V. KvK-nummer 75653095
      Bijzonderheden
    `);

    expect(rechten).toHaveLength(2);
    expect(rechten[1]).toMatchObject({
      rechtssituatie: 'erfpacht',
      naam: 'Paul Vismans Projecten Beheer Twee B.V.',
      straatHuisnummer: null,
      postcode: null,
      plaats: null,
    });
  });
});
