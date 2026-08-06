import { describe, expect, it } from 'vitest';
import {
  heeftBlokkerendeObjectmatch,
  normaliseerAdres,
  normaliseerPlaats,
  normaliseerPostcode,
  objectAdresSleutel,
  zoekBestaandeObjecten,
} from '@/lib/objectIdentity';

describe('objectidentiteit normaliseren', () => {
  it('normaliseert postcode, plaats en veelvoorkomende straatwoorden', () => {
    expect(normaliseerPostcode(' 5061 ab ')).toBe('5061AB');
    expect(normaliseerPlaats('’s-Hertogenbosch')).toBe('s hertogenbosch');
    expect(normaliseerAdres('Kerkstraat 10-A')).toBe('kerkstr 10 a');
    expect(normaliseerAdres('Parklaan 2')).toBe('parkln 2');
  });

  it('maakt een stabiele sleutel met postcode en adres', () => {
    expect(objectAdresSleutel({
      adres: 'Kerkstraat 10 A',
      postcode: '5061 AB',
      plaats: 'Oisterwijk',
    })).toBe('adres:5061AB|kerkstr 10 a');
  });

  it('valt zonder postcode terug op plaats en adres', () => {
    expect(objectAdresSleutel({
      adres: 'Markt 1',
      plaats: 'Tilburg',
    })).toBe('adres:tilburg|markt 1');
  });
});

describe('zoekBestaandeObjecten', () => {
  const objecten = [
    {
      id: 'obj-bag',
      adres: 'Kerkstraat 10 A',
      postcode: '5061 AB',
      plaats: 'Oisterwijk',
      bagVerblijfsobjectId: '0123456789012345',
    },
    {
      id: 'obj-adres',
      adres: 'Stationsstraat 4',
      postcode: '5038 ED',
      plaats: 'Tilburg',
    },
    {
      id: 'obj-mogelijk',
      adres: 'Markt 1',
      postcode: null,
      plaats: 'Breda',
    },
  ];

  it('geeft een BAG-identificatie altijd de hoogste prioriteit', () => {
    const matches = zoekBestaandeObjecten({
      adres: 'Ander adres 99',
      postcode: '0000AA',
      plaats: 'Elders',
      bagVerblijfsobjectId: '0123456789012345',
    }, objecten);

    expect(matches[0]).toMatchObject({
      niveau: 'bag_verblijfsobject',
      score: 100,
      object: { id: 'obj-bag' },
    });
  });

  it('herkent exact hetzelfde genormaliseerde postcode-adres', () => {
    const matches = zoekBestaandeObjecten({
      adres: 'Stationsstraat 4',
      postcode: '5038ED',
      plaats: 'Tilburg',
    }, objecten);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      niveau: 'exact_adres',
      score: 95,
      object: { id: 'obj-adres' },
    });
  });

  it('herkent een mogelijke match op adres en plaats wanneer postcode ontbreekt', () => {
    const matches = zoekBestaandeObjecten({
      adres: 'Markt 1',
      postcode: '4811XX',
      plaats: 'Breda',
    }, objecten);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      niveau: 'mogelijk_adres',
      score: 80,
      object: { id: 'obj-mogelijk' },
    });
  });

  it('geeft geen match bij een ander huisnummer of andere plaats', () => {
    expect(zoekBestaandeObjecten({
      adres: 'Stationsstraat 6',
      postcode: '5038ED',
      plaats: 'Tilburg',
    }, objecten)).toEqual([]);

    expect(zoekBestaandeObjecten({
      adres: 'Markt 1',
      plaats: 'Groningen',
    }, objecten)).toEqual([]);
  });

  it('sluit het huidige object uit en sorteert deterministisch', () => {
    const dubbel = [
      { id: 'b', adres: 'Dorpsstraat 1', postcode: '1234AB', plaats: 'Dorp' },
      { id: 'a', adres: 'Dorpsstraat 1', postcode: '1234AB', plaats: 'Dorp' },
      { id: 'huidig', adres: 'Dorpsstraat 1', postcode: '1234AB', plaats: 'Dorp' },
    ];

    const matches = zoekBestaandeObjecten({
      id: 'huidig',
      adres: 'Dorpsstraat 1',
      postcode: '1234 AB',
      plaats: 'Dorp',
    }, dubbel);

    expect(matches.map((m) => m.object.id)).toEqual(['a', 'b']);
  });

  it('markeert alleen BAG- en exacte adresmatches als blokkerend', () => {
    expect(heeftBlokkerendeObjectmatch([
      { object: objecten[2], niveau: 'mogelijk_adres', score: 80, reden: 'mogelijk' },
    ])).toBe(false);

    expect(heeftBlokkerendeObjectmatch([
      { object: objecten[1], niveau: 'exact_adres', score: 95, reden: 'exact' },
    ])).toBe(true);
  });
});
