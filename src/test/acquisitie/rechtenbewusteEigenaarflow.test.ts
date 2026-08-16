import { describe, expect, it } from 'vitest';
import type { KadasterRechtenBlok } from '@/lib/kadaster/rechtenBlokken';
import {
  bepaalRechtenbewusteEigenaar,
  bouwAutomatischeEigenaarPatch,
  bouwVerzendadres,
  bepaalEigenaarProcesStatus,
} from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';
import { bepaalSignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { bepaalWerkbakContext } from '@/lib/offMarket/acquisitie/werkbak';

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

const volleEigendom = blok({
  id: 'eigendom', persoonType: 'rechtspersoon', bedrijfsnaam: 'J.H.F. Schopman en Zonen B.V.',
  kvkNummer: '33006758', adresRegels: ['Sarphatistraat 370'], postcode: '1018GW',
  plaats: 'Amsterdam', aandeel: '1/1',
});

const gemeente = blok({
  id: 'gemeente', persoonType: 'rechtspersoon', bedrijfsnaam: 'Gemeente Amsterdam',
  kvkNummer: '34366966', adresRegels: ['Amstel 1'], postcode: '1011PN', plaats: 'Amsterdam',
  aandeel: '1/1', rechtstype: 'Eigendom (recht van)',
});

const erfpachter = blok({
  id: 'erfpacht', persoonType: 'rechtspersoon', bedrijfsnaam: 'Paul Vismans Projecten Beheer Twee B.V.',
  kvkNummer: '75653095', adresRegels: ['Herengracht 372'], postcode: '1016CH', plaats: 'Amsterdam',
  aandeel: '1/1', rechtstype: 'Erfpacht (recht van)',
});

describe('rechtenbewuste eigenaarflow', () => {
  it('volle eigendom kiest de eigenaar als primaire partij', () => {
    const r = bepaalRechtenbewusteEigenaar([volleEigendom]);
    expect(r.status).toBe('eenduidig');
    expect(r.rechtssituatie).toBe('volle_eigendom');
    expect(r.voorstel.eigenaar_bedrijfsnaam).toBe('J.H.F. Schopman en Zonen B.V.');
    expect(r.verzendadres).toBe('Sarphatistraat 370\n1018 GW Amsterdam');
    expect(r.controleNodig).toBe(false);
  });

  it('erfpacht kiest erfpachter primair en bewaart gemeente als bloot eigenaar', () => {
    const r = bepaalRechtenbewusteEigenaar([gemeente, erfpachter]);
    expect(r.rechtssituatie).toBe('erfpacht');
    expect(r.voorstel.eigenaar_bedrijfsnaam).toBe('Paul Vismans Projecten Beheer Twee B.V.');
    expect(r.blootEigenaar?.bedrijfsnaam).toBe('Gemeente Amsterdam');
    expect(r.controleNodig).toBe(false);
  });

  it('meerdere primaire rechthebbenden gaan naar controle zonder eigenaarpatch', () => {
    const tweede = blok({
      id: 'tweede', persoonType: 'rechtspersoon', bedrijfsnaam: 'Tweede B.V.',
      adresRegels: ['Dam 1'], postcode: '1012JS', plaats: 'Amsterdam', aandeel: '1/2',
    });
    const r = bepaalRechtenbewusteEigenaar([volleEigendom, tweede]);
    const patch = bouwAutomatischeEigenaarPatch({}, r);
    expect(r.status).toBe('ambigu');
    expect(patch?.eigenaar_controle_nodig).toBe(true);
    expect(patch?.eigenaar_bedrijfsnaam).toBeUndefined();
  });

  it('incompleet adres vereist controle', () => {
    const r = bepaalRechtenbewusteEigenaar([{ ...volleEigendom, plaats: null }]);
    expect(r.controleNodig).toBe(true);
  });

  it('overschrijft bestaande handmatige eigenaarvelden niet', () => {
    const r = bepaalRechtenbewusteEigenaar([volleEigendom]);
    const patch = bouwAutomatischeEigenaarPatch({
      eigenaar_bedrijfsnaam: 'Handmatig Vastgoed B.V.',
      eigenaar_kvk: '99999999',
    }, r);
    expect(patch?.eigenaar_bedrijfsnaam).toBeUndefined();
    expect(patch?.eigenaar_kvk).toBeUndefined();
    expect(patch?.eigenaar_straat_huisnummer).toBe('Sarphatistraat 370');
  });

  it('bouwt verzendadres deterministisch', () => {
    expect(bouwVerzendadres('Herengracht 372', '1016CH', 'Amsterdam'))
      .toBe('Herengracht 372\n1016 CH Amsterdam');
  });

  it('readiness happy path versus exception', () => {
    const basis = {
      id: 's1', status: 'eigenaar_gevonden', eigenaar_bedrijfsnaam: 'Voorbeeld B.V.',
      eigenaar_verzendadres: 'Herengracht 372\n1016 CH Amsterdam',
    } as any;
    const happy = bepaalSignaalReadiness({ signaal: basis, brieven: [] });
    expect(happy.fase).toBe('brief_voorbereiden');
    const exception = bepaalSignaalReadiness({
      signaal: { ...basis, eigenaar_controle_nodig: true, eigenaar_controle_reden: 'Controle nodig' },
      brieven: [],
    });
    expect(exception.fase).toBe('eigenaar_controleren');
    const ctx = bepaalWerkbakContext({ readiness: exception, brieven: [], toegevoegdOp: null });
    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieSubfilter).toBe('eigenaar_controleren');
  });

  it('processtatus ondersteunt gevonden/controleren/ontbreekt', () => {
    expect(bepaalEigenaarProcesStatus({})).toBe('ontbreekt');
    expect(bepaalEigenaarProcesStatus({ eigenaar_bedrijfsnaam: 'X B.V.' })).toBe('gevonden');
    expect(bepaalEigenaarProcesStatus({ eigenaar_controle_nodig: true })).toBe('controleren');
  });
});
