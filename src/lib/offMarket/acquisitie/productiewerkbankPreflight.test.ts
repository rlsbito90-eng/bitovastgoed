import { describe, expect, it } from 'vitest';
import {
  bepaalProductiePreflight,
  productiePreflightRedenLabel,
} from './productiewerkbankPreflight';

const volledigAdres = (adres: string | null | undefined) => Boolean(adres && /\d/.test(adres) && /\d{4}\s?[A-Z]{2}/i.test(adres));

function basis() {
  return {
    geselecteerdeSignaalIds: ['s1'],
    selecties: [{ selectieId: 'sel1', signaalId: 's1' }],
    formeleDossierSelectieIds: new Set(['sel1']),
    brieven: [{
      id: 'b1',
      signaalId: 's1',
      kanaal: 'post',
      status: 'concept',
      eigenaarBedrijfsnaam: 'Voorbeeld B.V.',
      verzendadres: 'Herengracht 372\n1016 CH Amsterdam',
    }],
    isVolledigPostadres: volledigAdres,
  };
}

describe('productiewerkbank preflight', () => {
  it('classificeert een geldig concept met formeel dossier als gereed', () => {
    const resultaat = bepaalProductiePreflight(basis());
    expect(resultaat.telling).toEqual({ totaal: 1, gereed: 1, aandacht: 0, verwerkt: 0 });
    expect(resultaat.regels[0]).toMatchObject({ status: 'gereed', reden: null, briefId: 'b1' });
  });

  it('vangt Bilderdijkstraat-achtige situatie vóór BR-finalisering af', () => {
    const invoer = basis();
    invoer.formeleDossierSelectieIds = new Set();
    const resultaat = bepaalProductiePreflight(invoer);
    expect(resultaat.regels[0]).toMatchObject({
      status: 'aandacht',
      reden: 'productiedossier_niet_gestart',
      briefId: null,
    });
    expect(productiePreflightRedenLabel(resultaat.regels[0].reden)).toBe('Productiedossier nog niet gestart');
  });

  it('behandelt een reeds definitieve brief als verwerkt en niet opnieuw gereed', () => {
    const invoer = basis();
    invoer.brieven = [{ ...invoer.brieven[0], status: 'definitief' }];
    const resultaat = bepaalProductiePreflight(invoer);
    expect(resultaat.telling).toEqual({ totaal: 1, gereed: 0, aandacht: 0, verwerkt: 1 });
    expect(resultaat.regels[0]).toMatchObject({ status: 'verwerkt', reden: 'al_definitief' });
  });

  it('blokkeert een concept zonder volledig postadres', () => {
    const invoer = basis();
    invoer.brieven = [{ ...invoer.brieven[0], verzendadres: 'Amsterdam' }];
    const resultaat = bepaalProductiePreflight(invoer);
    expect(resultaat.regels[0]).toMatchObject({ status: 'aandacht', reden: 'postadres_onvolledig' });
  });

  it('blokkeert een concept zonder geadresseerde', () => {
    const invoer = basis();
    invoer.brieven = [{
      ...invoer.brieven[0],
      eigenaarBedrijfsnaam: null,
      eigenaarNaam: null,
    }];
    const resultaat = bepaalProductiePreflight(invoer);
    expect(resultaat.regels[0]).toMatchObject({ status: 'aandacht', reden: 'geadresseerde_ontbreekt' });
  });

  it('rapporteert gemengde bulkselectie als gereed, aandacht en verwerkt', () => {
    const resultaat = bepaalProductiePreflight({
      geselecteerdeSignaalIds: ['s1', 's2', 's3'],
      selecties: [
        { selectieId: 'sel1', signaalId: 's1' },
        { selectieId: 'sel2', signaalId: 's2' },
        { selectieId: 'sel3', signaalId: 's3' },
      ],
      formeleDossierSelectieIds: new Set(['sel1', 'sel3']),
      brieven: [
        {
          id: 'b1', signaalId: 's1', status: 'concept', kanaal: 'post',
          eigenaarNaam: 'A. Test', verzendadres: 'Straat 1\n1234 AB Plaats',
        },
        {
          id: 'b2', signaalId: 's2', status: 'concept', kanaal: 'post',
          eigenaarNaam: 'B. Test', verzendadres: 'Straat 2\n1234 AB Plaats',
        },
        {
          id: 'b3', signaalId: 's3', status: 'definitief', kanaal: 'post',
          eigenaarNaam: 'C. Test', verzendadres: 'Straat 3\n1234 AB Plaats',
        },
      ],
      isVolledigPostadres: volledigAdres,
    });

    expect(resultaat.telling).toEqual({ totaal: 3, gereed: 1, aandacht: 1, verwerkt: 1 });
  });
});
