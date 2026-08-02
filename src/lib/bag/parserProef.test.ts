import { describe, expect, it } from 'vitest';
import { parseBagFixture, parserResultaatFingerprint, type BagBronRecord } from './parserProef';

const fixture: BagBronRecord[] = [
  { type: 'pand', identificatie: 'P2', bouwjaar: 1985, status: 'Pand in gebruik', geometrieWkt: 'POLYGON((0 0,1 0,1 1,0 0))' },
  { type: 'pand', identificatie: 'P1', bouwjaar: 1930, status: 'Pand in gebruik' },
  { type: 'nummeraanduiding', identificatie: 'N1', openbareRuimteNaam: 'Teststraat', huisnummer: 10, huisletter: 'A', postcode: '1234 ab', woonplaatsNaam: 'Tilburg' },
  { type: 'nummeraanduiding', identificatie: 'N2', openbareRuimteNaam: 'Markt', huisnummer: 5, huisnummertoevoeging: '02', postcode: '5000AA', woonplaatsNaam: 'Tilburg' },
  {
    type: 'verblijfsobject',
    identificatie: 'V1',
    pandIds: ['P1'],
    nummeraanduidingIds: ['N1'],
    gebruiksdoelen: ['woonfunctie', 'woonfunctie'],
    oppervlakte: 125,
  },
  {
    type: 'verblijfsobject',
    identificatie: 'V2',
    pandIds: ['P1', 'P2'],
    nummeraanduidingIds: ['N2'],
    gebruiksdoelen: ['winkelfunctie', 'woonfunctie'],
    oppervlakte: 240,
  },
];

describe('BAG parserproef', () => {
  it('normaliseert panden, VBO’s, adressen en relaties deterministisch', () => {
    const resultaat = parseBagFixture(fixture);

    expect(resultaat.panden.map(item => item.identificatie)).toEqual(['P1', 'P2']);
    expect(resultaat.verblijfsobjecten).toHaveLength(2);
    expect(resultaat.nummeraanduidingen[0]).toMatchObject({
      identificatie: 'N1',
      adres: 'Teststraat 10A',
      postcode: '1234AB',
    });
    expect(resultaat.pandVboRelaties).toEqual([
      { pandId: 'P1', verblijfsobjectId: 'V1' },
      { pandId: 'P1', verblijfsobjectId: 'V2' },
      { pandId: 'P2', verblijfsobjectId: 'V2' },
    ]);
    expect(resultaat.vboAdresRelaties).toEqual([
      { verblijfsobjectId: 'V1', nummeraanduidingId: 'N1' },
      { verblijfsobjectId: 'V2', nummeraanduidingId: 'N2' },
    ]);
    expect(resultaat.afwijzingen).toEqual([]);
  });

  it('registreert iedere technische afwijzing met code en reden', () => {
    const resultaat = parseBagFixture([
      { type: 'pand', identificatie: '', bouwjaar: 1900 },
      { type: 'pand', identificatie: 'P1', bouwjaar: 900 },
      { type: 'nummeraanduiding', identificatie: 'N1', openbareRuimteNaam: '', huisnummer: 1 },
      { type: 'verblijfsobject', identificatie: 'V1', pandIds: ['ONBEKEND'], nummeraanduidingIds: ['N1'], oppervlakte: 0 },
    ]);

    expect(resultaat.afwijzingen.map(item => item.code)).toEqual([
      'ontbrekende_identificatie',
      'ongeldig_bouwjaar',
      'onvolledig_adres',
      'ongeldige_oppervlakte',
    ]);
    expect(resultaat.afwijzingen.every(item => item.reden.length > 0)).toBe(true);
  });

  it('meldt ontbrekende relaties zonder de geldige VBO-bronregel te verliezen', () => {
    const resultaat = parseBagFixture([
      { type: 'verblijfsobject', identificatie: 'V1', pandIds: ['P404'], nummeraanduidingIds: ['N404'], oppervlakte: 80 },
    ]);

    expect(resultaat.verblijfsobjecten).toHaveLength(1);
    expect(resultaat.pandVboRelaties).toHaveLength(0);
    expect(resultaat.vboAdresRelaties).toHaveLength(0);
    expect(resultaat.afwijzingen.map(item => item.code)).toEqual([
      'ontbrekend_pand',
      'ontbrekende_nummeraanduiding',
    ]);
  });

  it('weigert duplicaten expliciet', () => {
    const resultaat = parseBagFixture([
      { type: 'pand', identificatie: 'P1', bouwjaar: 1900 },
      { type: 'pand', identificatie: 'P1', bouwjaar: 1901 },
    ]);

    expect(resultaat.panden).toHaveLength(1);
    expect(resultaat.afwijzingen[0].code).toBe('duplicaat_record');
  });

  it('levert bij gelijke invoer exact dezelfde fingerprint', () => {
    const eerste = parseBagFixture(fixture);
    const tweede = parseBagFixture(fixture);

    expect(parserResultaatFingerprint(eerste)).toBe(parserResultaatFingerprint(tweede));
  });

  it('legt een hervatbaar checkpoint vast', () => {
    const resultaat = parseBagFixture(fixture, 3);

    expect(resultaat.checkpoint).toEqual({ verwerkt: 3, laatstVerwerkteIndex: 5 });
    expect(resultaat.panden).toHaveLength(0);
    expect(resultaat.verblijfsobjecten).toHaveLength(2);
  });
});
