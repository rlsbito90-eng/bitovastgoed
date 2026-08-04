import { describe, expect, it } from 'vitest';
import {
  STANDAARD_KADASTER_BUDGETBELEID,
  beoordeelKadasterBudget,
  berekenKadasterAanvraagKosten,
  vatKadasterKostenSamen,
  type KadasterKostenEvent,
  type KadasterProduct,
} from './kostenBeheer';

const product: KadasterProduct = {
  code: 'rechten',
  naam: 'Rechteninformatie',
  tariefPerEenheid: 2.96,
  valuta: 'EUR',
  betaald: true,
  actief: true,
  explicieteBevestigingVereist: true,
};

const event = (overrides: Partial<KadasterKostenEvent> = {}): KadasterKostenEvent => ({
  id: crypto.randomUUID(),
  productCode: 'rechten',
  aantalEenheden: 1,
  geraamdeKosten: 2.96,
  werkelijkeKosten: 2.96,
  status: 'geleverd',
  gebruikerId: 'gebruiker-1',
  aangevraagdOp: '2026-08-04T10:00:00.000Z',
  hergebruikteBestaandeData: false,
  ...overrides,
});

describe('Kadaster kostenbeheer', () => {
  it('berekent bundelkosten exact op centen', () => {
    expect(berekenKadasterAanvraagKosten(product, 8)).toBe(23.68);
  });

  it('weigert ongeldige aantallen', () => {
    expect(() => berekenKadasterAanvraagKosten(product, 0)).toThrow();
    expect(() => berekenKadasterAanvraagKosten(product, 1.5)).toThrow();
  });

  it('telt niet-geleverde, mislukte en hergebruikte data niet als besteed budget', () => {
    const beoordeling = beoordeelKadasterBudget({
      isBeheerder: false,
      gebruikerId: 'gebruiker-1',
      nu: new Date('2026-08-04T12:00:00.000Z'),
      beleid: STANDAARD_KADASTER_BUDGETBELEID,
      events: [
        event({ status: 'niet_geleverd' }),
        event({ status: 'mislukt' }),
        event({ hergebruikteBestaandeData: true }),
      ],
    }, 2.96);

    expect(beoordeling.besteedVandaag).toBe(0);
    expect(beoordeling.besteedDezeMaandGebruiker).toBe(0);
  });

  it('blokkeert een medewerker bij een harde limiet maar laat beheerder overschrijven', () => {
    const beleid = {
      ...STANDAARD_KADASTER_BUDGETBELEID,
      daglimietGebruiker: 5,
      hardeBlokkadeActief: true,
    };
    const events = [event({ werkelijkeKosten: 4, geraamdeKosten: 4 })];

    const medewerker = beoordeelKadasterBudget({
      isBeheerder: false,
      gebruikerId: 'gebruiker-1',
      nu: new Date('2026-08-04T12:00:00.000Z'),
      beleid,
      events,
    }, 2);
    expect(medewerker.toegestaan).toBe(false);
    expect(medewerker.blokkades).toHaveLength(1);

    const beheerder = beoordeelKadasterBudget({
      isBeheerder: true,
      gebruikerId: 'gebruiker-1',
      nu: new Date('2026-08-04T12:00:00.000Z'),
      beleid,
      events,
    }, 2);
    expect(beheerder.toegestaan).toBe(true);
    expect(beheerder.beheerderKanOverschrijven).toBe(true);
  });

  it('maakt week- of maandoverzichten per product', () => {
    const overzicht = vatKadasterKostenSamen([
      event(),
      event({ productCode: 'contractloos', geraamdeKosten: 0.82, werkelijkeKosten: 0.82, aantalEenheden: 1 }),
      event({ aangevraagdOp: '2026-07-01T10:00:00.000Z' }),
    ], new Date('2026-08-01T00:00:00.000Z'), new Date('2026-08-31T23:59:59.999Z'));

    expect(overzicht.aantalAanvragen).toBe(2);
    expect(overzicht.werkelijkeKosten).toBe(3.78);
    expect(overzicht.perProduct).toEqual([
      { productCode: 'contractloos', aantalAanvragen: 1, aantalEenheden: 1, werkelijkeKosten: 0.82 },
      { productCode: 'rechten', aantalAanvragen: 1, aantalEenheden: 1, werkelijkeKosten: 2.96 },
    ]);
  });
});
