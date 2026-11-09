import {afterEach,describe,expect,it,vi} from 'vitest';
import {parsePdokCentroid,zoekBagAdressen,zoekPdokWoonplaatsen} from './pdokLookup';

const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;vi.restoreAllMocks();});
describe('PDOK BAG/woonplaats — verifieerbare WGS84',()=>{
  it('leest WKT als longitude latitude, en weigert punten buiten Nederland',()=>{
    expect(parsePdokCentroid('POINT(5.37553215 52.15266021)')).toEqual({
      longitude:5.37553215,latitude:52.15266021,
    });
    expect(parsePdokCentroid('POINT(52.15 5.37)')).toBeNull();
    expect(parsePdokCentroid('POLYGON(1 2)')).toBeNull();
    expect(parsePdokCentroid('POINT(NaN 52)')).toBeNull();
  });
  it('zoekt alleen officiële BAG-adressen zonder automatische oproep',async()=>{
    const mock=vi.fn().mockResolvedValue({
      ok:true,json:async()=>({response:{docs:[{
        id:'adr-123',type:'adres',weergavenaam:'Stationsplein 12, Amersfoort',
        straatnaam:'Stationsplein',huisnummer:12,
        postcode:'3818LE',woonplaatsnaam:'Amersfoort',
        nummeraanduiding_id:'0307200000595639',
        centroide_ll:'POINT(5.37553215 52.15266021)',
      }]}}),
    });
    globalThis.fetch=mock;
    const res=await zoekBagAdressen({straat:'Stationsplein 12',plaats:'Amersfoort'});
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id:'adr-123',type:'adres',straat:'Stationsplein',huisnummer:'12',
      postcode:'3818LE',latitude:52.15266021,longitude:5.37553215,
    });
    const url=new URL(mock.mock.calls[0][0]);
    expect(url.searchParams.get('fq')).toBe('type:adres');
    expect(url.searchParams.get('fl')).toContain('centroide_ll');
  });
  it('beperkt woonplaatszoekactie tot type woonplaats',async()=>{
    const mock=vi.fn().mockResolvedValue({
      ok:true,json:async()=>({response:{docs:[
        {id:'wpl-amersfoort',type:'woonplaats',weergavenaam:'Amersfoort',
          woonplaatsnaam:'Amersfoort',centroide_ll:'POINT(5.38 52.15)'},
        {id:'weg-amersfoort',type:'weg',weergavenaam:'Weg',
          centroide_ll:'POINT(5.38 52.15)'},
      ]}}),
    });
    globalThis.fetch=mock;
    const res=await zoekPdokWoonplaatsen('Amersfoort');
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id:'wpl-amersfoort',type:'woonplaats',longitude:5.38,latitude:52.15,
    });
    expect(new URL(mock.mock.calls[0][0]).searchParams.get('fq')).toBe('type:woonplaats');
  });
});
