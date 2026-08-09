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
  kadastrale_aanduiding: '',
  eigenaarbron: '',
};

describe('Kadaster eigenaarvoorstel', () => {
  it('zet een natuurlijke persoon om naar particulier en gevonden', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({ persoonType: 'natuurlijk', naam: 'Jan Jansen', kadastraleAanduiding: 'AMS A 1234' }),
    ]);
    expect(voorstel).toMatchObject({
      status: 'eenduidig', eigenaarstatus: 'gevonden', eigenaar_type: 'particulier',
      eigenaar_naam: 'Jan Jansen', eigenaarbron: 'kadaster', kadastrale_aanduiding: 'AMS A 1234',
    });
  });

  it.each([
    ['Bito Vastgoed B.V.', 'bv'],
    ['Stichting Woonfonds', 'stichting'],
    ['VvE Parklaan 10', 'vve'],
    ['Gemeente Amsterdam', 'overheid'],
  ] as const)('herkent duidelijke rechtspersoon %s als %s', (naam, type) => {
    expect(maakKadasterEigenaarVoorstel([
      blok({ persoonType: 'rechtspersoon', bedrijfsnaam: naam }),
    ])).toMatchObject({ status: 'eenduidig', eigenaar_type: type, eigenaar_bedrijfsnaam: naam });
  });

  it('classificeert een onduidelijke rechtspersoon defensief als onbekend', () => {
    expect(maakKadasterEigenaarVoorstel([
      blok({ persoonType: 'rechtspersoon', bedrijfsnaam: 'Vastgoedfonds Noord' }),
    ])).toMatchObject({ status: 'eenduidig', eigenaar_type: 'onbekend' });
  });

  it('kiest niet stil tussen meerdere verschillende rechthebbenden', () => {
    expect(maakKadasterEigenaarVoorstel([
      blok({ id: 'a', persoonType: 'natuurlijk', naam: 'Jan Jansen' }),
      blok({ id: 'b', persoonType: 'natuurlijk', naam: 'Piet Pieters' }),
    ])).toEqual({ status: 'ambigu' });
  });

  it('behandelt dezelfde rechthebbende in meerdere rechtenblokken als eenduidig', () => {
    expect(maakKadasterEigenaarVoorstel([
      blok({ id: 'a', persoonType: 'rechtspersoon', bedrijfsnaam: 'Voorbeeld B.V.' }),
      blok({ id: 'b', rechtstype: 'Erfpacht (recht van)', persoonType: 'rechtspersoon', bedrijfsnaam: 'Voorbeeld B.V.' }),
    ])).toMatchObject({ status: 'eenduidig', eigenaar_bedrijfsnaam: 'Voorbeeld B.V.' });
  });

  it('overschrijft bestaande handmatige velden niet', () => {
    const voorstel = maakKadasterEigenaarVoorstel([
      blok({ persoonType: 'rechtspersoon', bedrijfsnaam: 'Kadaster B.V.', kvkNummer: '12345678' }),
    ]);
    const resultaat = pasKadasterVoorstelToe({
      ...leegForm,
      eigenaar_bedrijfsnaam: 'Handmatig Vastgoed B.V.',
      eigenaar_kvk: '87654321',
      eigenaarbron: 'netwerk',
    }, voorstel);

    expect(resultaat.eigenaar_bedrijfsnaam).toBe('Handmatig Vastgoed B.V.');
    expect(resultaat.eigenaar_kvk).toBe('87654321');
    expect(resultaat.eigenaarbron).toBe('netwerk');
    expect(resultaat.eigenaarstatus).toBe('gevonden');
  });
});
