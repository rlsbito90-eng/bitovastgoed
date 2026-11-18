import {describe,expect,it} from 'vitest';
import {guardObjectPatch} from '@/lib/dataIntegrity/objectPayload';
import {maakInlineFinancieelPatch,maakInlineWisPatch,moetStatusArchiveren} from './inlineCommercieel';
import type {ObjectVastgoed} from '@/data/mock-data';

const object={vraagprijs:850000,huurinkomsten:70000} as ObjectVastgoed;
describe('Directe commerciële objectvelden',()=>{
  it('schrijft vraagprijs en jaarhuur onafhankelijk, ook 0 mag',()=>{
    expect(maakInlineFinancieelPatch('vraagprijs',900000)).toEqual({vraagprijs:900000});
    expect(maakInlineFinancieelPatch('huurinkomsten',0)).toEqual({huurinkomsten:0});
    expect(maakInlineFinancieelPatch('huurinkomsten',69000))
      .not.toHaveProperty('vraagprijs');
  });
  it('weigert onbedoeld wissen en ongeldige invoer',()=>{
    expect(()=>maakInlineFinancieelPatch('vraagprijs',undefined)).toThrow();
    expect(()=>maakInlineFinancieelPatch('vraagprijs',NaN)).toThrow();
    expect(()=>maakInlineFinancieelPatch('huurinkomsten',-5)).toThrow();
    expect(()=>maakInlineFinancieelPatch('vraagprijs',Infinity)).toThrow();
  });
  it('alleen een expliciete wisactie mag financieel beschermde velden leegmaken',()=>{
    expect(guardObjectPatch({vraagprijs:null} as any,object)).not.toHaveProperty('vraagprijs');
    expect(guardObjectPatch(maakInlineWisPatch('vraagprijs'),object))
      .toEqual({vraagprijs:null});
    expect(guardObjectPatch(maakInlineWisPatch('huurinkomsten'),object))
      .toEqual({huurinkomsten:null});
  });
  it('terminal status vraagt bevestiging vanwege automatische archivering',()=>{
    for(const status of ['verkocht','ingetrokken','afgevallen'] as const){
      expect(moetStatusArchiveren(status)).toBe(true);
    }
    for(const status of ['beschikbaar','te_beoordelen','on_hold','onder_optie'] as const){
      expect(moetStatusArchiveren(status)).toBe(false);
    }
  });
});
