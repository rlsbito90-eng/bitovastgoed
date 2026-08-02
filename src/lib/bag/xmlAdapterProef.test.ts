import { describe, expect, it } from 'vitest';
import { parseBagFixture, parserResultaatFingerprint } from './parserProef';
import { parseBagXmlChunks } from './xmlAdapterProef';

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<bag:Levering xmlns:bag="urn:bag:test" xmlns:obj="urn:object:test">
  <bag:Pand>
    <obj:identificatie>0363100012345678</obj:identificatie>
    <bag:oorspronkelijkBouwjaar>1928</bag:oorspronkelijkBouwjaar>
    <bag:status>Pand in gebruik</bag:status>
    <bag:geometrieWkt>POLYGON((4 52,4.1 52,4.1 52.1,4 52))</bag:geometrieWkt>
  </bag:Pand>
  <bag:Nummeraanduiding>
    <obj:identificatie>0363200000000010</obj:identificatie>
    <bag:openbareRuimteNaam>Teststraat</bag:openbareRuimteNaam>
    <bag:huisnummer>10</bag:huisnummer>
    <bag:huisletter>A</bag:huisletter>
    <bag:postcode>1012 AB</bag:postcode>
    <bag:woonplaatsNaam>Amsterdam</bag:woonplaatsNaam>
    <bag:status>Naamgeving uitgegeven</bag:status>
  </bag:Nummeraanduiding>
  <bag:Verblijfsobject>
    <obj:identificatie>0363010000000010</obj:identificatie>
    <bag:pandRef>0363100012345678</bag:pandRef>
    <bag:nummeraanduidingRef>0363200000000010</bag:nummeraanduidingRef>
    <bag:gebruiksdoel>woonfunctie</bag:gebruiksdoel>
    <bag:gebruiksdoel>winkelfunctie</bag:gebruiksdoel>
    <bag:oppervlakte>145</bag:oppervlakte>
    <bag:status>Verblijfsobject in gebruik</bag:status>
  </bag:Verblijfsobject>
</bag:Levering>`;

describe('BAG XML-adapterproef', () => {
  it('vertaalt namespaced XML naar parserrecords', () => {
    const resultaat = parseBagXmlChunks([fixture]);

    expect(resultaat.fouten).toEqual([]);
    expect(resultaat.records).toHaveLength(3);
    expect(resultaat.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'pand', identificatie: '0363100012345678', bouwjaar: 1928 }),
      expect.objectContaining({ type: 'nummeraanduiding', postcode: '1012 AB' }),
      expect.objectContaining({
        type: 'verblijfsobject',
        pandIds: ['0363100012345678'],
        nummeraanduidingIds: ['0363200000000010'],
        gebruiksdoelen: ['woonfunctie', 'winkelfunctie'],
      }),
    ]));
  });

  it('werkt identiek wanneer tags over willekeurige chunks zijn verdeeld', () => {
    const volledig = parseBagXmlChunks([fixture]);
    const chunks = [fixture.slice(0, 73), fixture.slice(73, 311), fixture.slice(311, 699), fixture.slice(699)];
    const verdeeld = parseBagXmlChunks(chunks);

    expect(verdeeld.records).toEqual(volledig.records);
    expect(verdeeld.checkpoint.ontvangenTekens).toBe(fixture.length);
  });

  it('levert deterministisch hetzelfde parserresultaat bij verschillende chunkgroottes', () => {
    const runA = parseBagFixture(parseBagXmlChunks([fixture]).records);
    const runB = parseBagFixture(parseBagXmlChunks([...fixture].map(teken => teken)).records);

    expect(parserResultaatFingerprint(runA)).toBe(parserResultaatFingerprint(runB));
    expect(runA.pandVboRelaties).toEqual([
      { pandId: '0363100012345678', verblijfsobjectId: '0363010000000010' },
    ]);
    expect(runA.nummeraanduidingen[0].adres).toBe('Teststraat 10A');
    expect(runA.nummeraanduidingen[0].postcode).toBe('1012AB');
  });

  it('rapporteert een XML-record dat niet is afgesloten', () => {
    const resultaat = parseBagXmlChunks(['<bag:Pand><bag:identificatie>123</bag:identificatie>']);

    expect(resultaat.records).toEqual([]);
    expect(resultaat.fouten).toEqual([
      expect.objectContaining({ code: 'onvolledig_element' }),
    ]);
  });

  it('laat verpakkingselementen buiten de BAG-records ongemoeid', () => {
    const resultaat = parseBagXmlChunks(['<Levering><Metadata>test</Metadata></Levering>']);

    expect(resultaat.records).toEqual([]);
    expect(resultaat.fouten).toEqual([]);
  });

  it('kan decimale waarden met een komma technisch vertalen', () => {
    const xml = `<Verblijfsobject><identificatie>vbo-1</identificatie><oppervlakte>76,4</oppervlakte></Verblijfsobject>`;
    const resultaat = parseBagXmlChunks([xml]);

    expect(resultaat.records[0]).toEqual(expect.objectContaining({ oppervlakte: 76.4 }));
  });
});
