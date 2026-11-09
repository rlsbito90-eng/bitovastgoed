import {describe,it,expect} from 'vitest';
import {pdokKeuzeControle} from '@/components/geo/PdokLocatieVerifier';
import type {BagAdresResultaat} from '@/lib/bag/pdokLookup';

const adres:BagAdresResultaat={
  id:'adr-test',weergavenaam:'Hoeflaan 5a, Ochten',straat:'Hoeflaan',
  huisnummer:'5',huisletter:'A',huisnummertoevoeging:null,
  postcode:'4051AG',woonplaats:'Ochten',nummeraanduiding_id:'1234567890123456',
  adresseerbaar_object_id:null,latitude:51.92,longitude:5.58,type:'adres',
};
const plaats:BagAdresResultaat={...adres,id:'wpl-amersfoort',weergavenaam:'Amersfoort',
  straat:null,huisnummer:null,huisletter:null,postcode:null,
  woonplaats:'Amersfoort',nummeraanduiding_id:null,type:'woonplaats',
};
describe('PDOK locatiebevestiging — guardrails',()=>{
  it('bevestigt een juist adres, inclusief huisletter',()=>{
    expect(pdokKeuzeControle(adres,{
      mode:'object',adres:'Hoeflaan 5a',postcode:'4051 AG',plaats:'Ochten',
    })).toBeNull();
  });
  it('weigert postcodeverschil of ander huisnummer',()=>{
    expect(pdokKeuzeControle(adres,{
      mode:'object',adres:'Hoeflaan 5a',postcode:'4052 AB',plaats:'Ochten',
    })).toMatch(/Postcode/);
    expect(pdokKeuzeControle(adres,{
      mode:'object',adres:'Hoeflaan 9',postcode:'4051 AG',plaats:'Ochten',
    })).toMatch(/Straat of huisnummer/);
  });
  it('vereist officiële BAG-adresidentificatie',()=>{
    expect(pdokKeuzeControle({...adres,nummeraanduiding_id:null},{
      mode:'object',adres:'Hoeflaan 5a',plaats:'Ochten',
    })).toMatch(/BAG/);
  });
  it('laat niet per ongeluk een andere vertrekplaats bevestigen',()=>{
    expect(pdokKeuzeControle(plaats,{mode:'woonplaats',centrum:'Amersfoort'})).toBeNull();
    expect(pdokKeuzeControle(plaats,{mode:'woonplaats',centrum:'Utrecht'})).toMatch(/wijkt af/);
  });
});
