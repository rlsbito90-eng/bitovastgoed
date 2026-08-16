import { describe, expect, it } from 'vitest';
import { mapRechtenBlokken } from '@/lib/kadaster/rechtenBlokken';
import { bepaalRechtenbewusteEigenaar } from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';

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
    expect(uitkomst.blootEigenaar?.bedrijfsnaam).toBe('Gemeente Amsterdam');
    expect(uitkomst.blootEigenaar?.kvk).toBe('34366966');
  });
});
