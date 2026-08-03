import { describe, expect, it } from 'vitest';
import { parseOfficieelBagRecord } from './officieleXmlRecordAdapter';

const pandXml = `
<sl:bagObject xmlns:sl="http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601"
  xmlns:obj="www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601"
  xmlns:typ="www.kadaster.nl/schemas/lvbag/imbag/typen/v20200601"
  xmlns:gml="http://www.opengis.net/gml/3.2">
  <sl:object>
    <obj:Pand>
      <obj:identificatie>0106100000000001</obj:identificatie>
      <obj:status>Pand in gebruik</obj:status>
      <obj:oorspronkelijkBouwjaar>1987</obj:oorspronkelijkBouwjaar>
      <obj:geconstateerd>false</obj:geconstateerd>
      <obj:documentdatum>2021-11-15</obj:documentdatum>
      <obj:documentnummer>DOC-1</obj:documentnummer>
      <obj:geometrie>
        <gml:Polygon srsName="urn:ogc:def:crs:EPSG::28992">
          <gml:exterior><gml:LinearRing>
            <gml:posList srsDimension="3">100 200 0 110 200 0 110 210 0 100 200 0</gml:posList>
          </gml:LinearRing></gml:exterior>
        </gml:Polygon>
      </obj:geometrie>
    </obj:Pand>
  </sl:object>
  <sl:voorkomen>
    <typ:Voorkomen>
      <typ:voorkomenidentificatie>3</typ:voorkomenidentificatie>
      <typ:beginGeldigheid>2020-01-01</typ:beginGeldigheid>
      <typ:tijdstipRegistratie>2020-01-02T12:00:00</typ:tijdstipRegistratie>
      <typ:tijdstipRegistratieLV>2020-01-02T12:01:00</typ:tijdstipRegistratieLV>
    </typ:Voorkomen>
  </sl:voorkomen>
</sl:bagObject>`;

const vboXml = `
<sl:bagObject xmlns:sl="http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601"
  xmlns:obj="www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601"
  xmlns:gml="http://www.opengis.net/gml/3.2">
  <sl:heeftAlsHoofdadres><obj:NummeraanduidingRef>0106200000000001</obj:NummeraanduidingRef></sl:heeftAlsHoofdadres>
  <sl:object>
    <obj:Verblijfsobject>
      <obj:identificatie>0106010000000001</obj:identificatie>
      <obj:status>Verblijfsobject in gebruik</obj:status>
      <obj:gebruiksdoel>woonfunctie</obj:gebruiksdoel>
      <obj:gebruiksdoel>kantoorfunctie</obj:gebruiksdoel>
      <obj:oppervlakte>125</obj:oppervlakte>
      <obj:maaktDeelUitVan><obj:PandRef>0106100000000001</obj:PandRef></obj:maaktDeelUitVan>
      <obj:geometrie><gml:Point><gml:pos srsDimension="3">100 200 0</gml:pos></gml:Point></obj:geometrie>
    </obj:Verblijfsobject>
  </sl:object>
</sl:bagObject>`;

const nummerXml = `
<sl:bagObject xmlns:sl="http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601"
  xmlns:obj="www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601">
  <sl:object>
    <obj:Nummeraanduiding>
      <obj:identificatie>0106200000000001</obj:identificatie>
      <obj:status>Naamgeving uitgegeven</obj:status>
      <obj:huisnummer>12</obj:huisnummer>
      <obj:huisletter>A</obj:huisletter>
      <obj:huisnummertoevoeging>2</obj:huisnummertoevoeging>
      <obj:postcode>9401AA</obj:postcode>
      <obj:ligtAan><obj:OpenbareRuimteRef>0106300000000001</obj:OpenbareRuimteRef></obj:ligtAan>
    </obj:Nummeraanduiding>
  </sl:object>
</sl:bagObject>`;

describe('officiële BAG XML-recordadapter', () => {
  it('leest pandvelden, voorkomenmetadata en 3D RD-geometrie', () => {
    const result = parseOfficieelBagRecord(pandXml);
    expect(result.fouten).toEqual([]);
    expect(result.record?.objecttype).toBe('Pand');
    expect(result.record?.identificatie).toBe('0106100000000001');
    expect(result.record?.velden.oorspronkelijkBouwjaar).toBe(1987);
    expect(result.record?.voorkomen.voorkomenidentificatie).toBe(3);
    expect(result.record?.geometrie).toMatchObject({ vorm: 'polygoon', crs: 'EPSG:28992', dimensie: 3 });
    expect(result.record?.geometrie.coordinaten).toHaveLength(12);
    expect(result.parserRecord).toMatchObject({ type: 'pand', bouwjaar: 1987 });
  });

  it('leest VBO-gebruiksdoelen, oppervlakte en relaties', () => {
    const result = parseOfficieelBagRecord(vboXml);
    expect(result.fouten).toEqual([]);
    expect(result.record?.velden.gebruiksdoelen).toEqual(['woonfunctie', 'kantoorfunctie']);
    expect(result.record?.velden.oppervlakte).toBe(125);
    expect(result.record?.relaties.pandIds).toEqual(['0106100000000001']);
    expect(result.record?.relaties.nummeraanduidingIds).toEqual(['0106200000000001']);
    expect(result.parserRecord).toMatchObject({
      type: 'verblijfsobject',
      pandIds: ['0106100000000001'],
      nummeraanduidingIds: ['0106200000000001'],
    });
  });

  it('leest nummeraanduiding en openbare-ruimterelatie', () => {
    const result = parseOfficieelBagRecord(nummerXml);
    expect(result.fouten).toEqual([]);
    expect(result.record?.velden).toMatchObject({ huisnummer: 12, huisletter: 'A', huisnummertoevoeging: '2', postcode: '9401AA' });
    expect(result.record?.relaties.openbareRuimteIds).toEqual(['0106300000000001']);
    expect(result.parserRecord).toMatchObject({ type: 'nummeraanduiding', huisnummer: 12, postcode: '9401AA' });
  });

  it('herkent inactieve voorkomenmetadata', () => {
    const xml = pandXml.replace('</typ:Voorkomen>', '<typ:tijdstipInactief>2022-01-01T00:00:00</typ:tijdstipInactief></typ:Voorkomen>');
    expect(parseOfficieelBagRecord(xml).record?.voorkomen.tijdstipInactief).toBe('2022-01-01T00:00:00');
  });

  it('weigert een onbekend objecttype', () => {
    const result = parseOfficieelBagRecord('<bagObject><Onbekend /></bagObject>');
    expect(result.record).toBeNull();
    expect(result.fouten[0]?.code).toBe('onbekend_objecttype');
  });

  it('weigert een BAG-object zonder identificatie', () => {
    const result = parseOfficieelBagRecord('<bagObject><Pand><status>Pand in gebruik</status></Pand></bagObject>');
    expect(result.record).toBeNull();
    expect(result.fouten[0]?.code).toBe('ontbrekende_identificatie');
  });

  it('rapporteert geometrie waarvan de dimensie niet sluit', () => {
    const xml = pandXml.replace('100 200 0 110 200 0 110 210 0 100 200 0', '100 200 0 110');
    const result = parseOfficieelBagRecord(xml);
    expect(result.fouten[0]?.code).toBe('ongeldige_geometrie');
  });
});
