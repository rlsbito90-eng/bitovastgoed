import {describe,expect,it} from 'vitest';
import type {ObjectVastgoed} from '@/data/mock-data';
import {guardObjectPatch} from '@/lib/dataIntegrity/objectPayload';
import {maakObjectTypePatch,maakOppervlaktePatch,maakOppervlakteWisPatch,eigendomIsStandaard} from './inlineFysiek';

describe('Inline fysiek: gevalideerde patches zonder verborgen mutaties',()=>{
  it('houdt VVO, BVO, GBO, totaal en perceel onafhankelijk',()=>{
    expect(maakOppervlaktePatch('oppervlakteVvo',522.7))
      .toEqual({oppervlakteVvo:522.7});
    expect(maakOppervlaktePatch('perceelOppervlakte',323))
      .toEqual({perceelOppervlakte:323});
    expect(maakOppervlaktePatch('oppervlakteBvo',180))
      .not.toHaveProperty('oppervlakteGbo');
  });
  it('weert leeg, negatief, nul, NaN en meer dan twee decimalen',()=>{
    for(const n of [undefined,-1,0,Number.NaN,1000000000,10.123]){
      expect(()=>maakOppervlaktePatch('oppervlakte',n)).toThrow();
    }
  });
  it('wist beschermde oppervlakten alleen na expliciete instructie',()=>{
    const current={oppervlakteVvo:120} as ObjectVastgoed;
    expect(guardObjectPatch({oppervlakteVvo:null} as any,current))
      .not.toHaveProperty('oppervlakteVvo');
    expect(guardObjectPatch(maakOppervlakteWisPatch('oppervlakteVvo'),current))
      .toEqual({oppervlakteVvo:null});
  });
  it('wijzigt bij nieuw type ook legacy klasse, en wist incompatibele subtypen',()=>{
    const patch=maakObjectTypePatch({id:'woning',slug:'residentieel'});
    expect(patch).toMatchObject({
      propertyTypeId:'woning',type:'wonen',propertySubtypeIds:[],subcategorieId:null,
    });
    expect(patch).not.toHaveProperty('dealTypeIds');
    expect(()=>maakObjectTypePatch({id:'x',slug:'niet-bestaand'})).toThrow();
  });
  it('houdt legacy en eigen omschrijvingen behouden tot een expliciete keuze',()=>{
    expect(eigendomIsStandaard('Erfpacht')).toBe(true);
    expect(eigendomIsStandaard('100% eigendom aandeel ongeverifieerd')).toBe(false);
    expect(eigendomIsStandaard(undefined)).toBe(false);
  });
});
