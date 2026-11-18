import {describe,expect,it} from 'vitest';
import {locatieInvoerVanObject,maakLocatiePatch} from './inlineLocatie';
import type {ObjectVastgoed} from '@/data/mock-data';

const huidig={
  id:'o',adres:'Hoofdstraat 12',postcode:'1234 AB',plaats:'Utrecht',
  provincie:'Utrecht',publiekeRegio:'Midden-Nederland',
  geoLat:52.1,geoLon:5.1,geoBron:'BAG',geoGeverifieerdOp:'2026-11-01',
} as ObjectVastgoed;

describe('Objectadres direct wijzigen zonder verkeerde oude BAG-verificatie',()=>{
  it('wijzigt publieke regio zonder intern adres of geodata aan te raken',()=>{
    const form={...locatieInvoerVanObject(huidig),publiekeRegio:'Randstad'};
    expect(maakLocatiePatch(huidig,form)).toEqual({publiekeRegio:'Randstad'});
  });
  it('wijzigt officiële adresvelden atomair en zet verouderde geo-velden expliciet op null',()=>{
    const form={...locatieInvoerVanObject(huidig),adres:'Nieuweweg 15',plaats:'Rotterdam',provincie:'Zuid-Holland'};
    expect(maakLocatiePatch(huidig,form)).toEqual({
      adres:'Nieuweweg 15',plaats:'Rotterdam',provincie:'Zuid-Holland',
      geoLat:null,geoLon:null,geoBron:null,geoGeverifieerdOp:null,
    });
  });
  it('herformatteert postcode consistent en laat alleen spatie/casewijziging met rust',()=>{
    expect(maakLocatiePatch(huidig,{
      ...locatieInvoerVanObject(huidig),postcode:'1234ab',
    })).toEqual({});
    expect(maakLocatiePatch(huidig,{
      ...locatieInvoerVanObject(huidig),postcode:'2345cd',
    })).toMatchObject({postcode:'2345 CD',geoLat:null});
  });
  it('weigert een gewijzigde postcode met onjuiste invoer zonder te saven',()=>{
    expect(()=>maakLocatiePatch(huidig,{
      ...locatieInvoerVanObject(huidig),postcode:'12 A',
    })).toThrow('vier cijfers en twee letters');
  });
  it('werkt ook op gedeeltelijke adressen zonder geo-verificatie',()=>{
    const o={id:'x',plaats:'Den Haag',provincie:'Zuid-Holland'} as ObjectVastgoed;
    expect(maakLocatiePatch(o,{
      ...locatieInvoerVanObject(o),adres:'Korteweg 4',
    })).toEqual({adres:'Korteweg 4'});
  });
  it('laat bestaande adresgegevens ongemoeid bij ongewijzigde invoer',()=>{
    expect(maakLocatiePatch(huidig,locatieInvoerVanObject(huidig))).toEqual({});
  });
});
