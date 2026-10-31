import {describe,it,expect} from 'vitest';
import { GEMEENTEN_2026_PER_PROVINCIE,gemeentenVoorProvincies,isGemeenteToken,alsGemeenteToken,gemeenteUitToken,normaliseerGemeenteNaam } from './gemeenten2026';
describe('2026 gemeenten provinciekeuze',()=>{
 it('omvat 12 provincies en 342 gemeenten',()=>{
   expect(Object.keys(GEMEENTEN_2026_PER_PROVINCIE)).toHaveLength(12);
   expect(Object.values(GEMEENTEN_2026_PER_PROVINCIE).reduce((s,a)=>s+a.length,0)).toBe(342);
 });
 it('laat uitsluitend gemeenten van de gekozen provincie zien',()=>{
   const b=gemeentenVoorProvincies(['Noord-Brabant']);
   expect(b).toContain('Oisterwijk'); expect(b).toContain('Breda'); expect(b).not.toContain('Rotterdam');
   expect(gemeentenVoorProvincies(['Utrecht'])).toContain('De Ronde Venen');
 });
 it('ondersteunt meerdere provincies en voorkomt dubbele gemeenten',()=>{
   const all=gemeentenVoorProvincies(['Gelderland','Gelderland','Utrecht']);
   expect(all).toHaveLength(77);
 });
 it('laat oude steden intact en gebruikt expliciet onderscheidende tokens voor gemeenten',()=>{
   expect(isGemeenteToken('Rotterdam')).toBe(false);
   expect(alsGemeenteToken('De Ronde Venen')).toBe('gemeente:De Ronde Venen');
   expect(gemeenteUitToken('gemeente:De Ronde Venen')).toBe('De Ronde Venen');
 });
 it('herkent de gebruikelijke gemeentenaam Den Haag',()=>{
   expect(normaliseerGemeenteNaam("'s-Gravenhage")).toBe('den haag');
 });
});

import { berekenMatchScore, type Zoekprofiel, type ObjectVastgoed } from '@/data/mock-data';
describe('legacy score: gemeente is niet automatisch woonplaats of provincie',()=>{
 const obj={id:'o',type:'wonen',propertyTypeId:'wonen',provincie:'Utrecht',plaats:'Mijdrecht',vraagprijs:450000} as ObjectVastgoed;
 const zp={id:'z',relatieId:'r',naam:'Gemeente De Ronde Venen',typeVastgoed:[],propertyTypeIds:['wonen'],
   regio:['Utrecht'],steden:['gemeente:De Ronde Venen'],prijsMax:900000,status:'actief'} as Zoekprofiel;
 it('voorkomt 20 onterechte regiopunten zonder bevestigde gemeentecode',()=>{
   const m=berekenMatchScore(obj,zp);
   expect(m).not.toBeNull();
   expect(m?.ontbrekendeData).toContain('regio');
   expect(m?.factoren.some(f=>f.categorie==='regio' && f.aard==='positief')).toBe(false);
 });
 it('ondersteunt heel Nederland bij bestaande scoreberekening',()=>{
   const m=berekenMatchScore(obj,{...zp,steden:[],regio:['Heel Nederland']});
   expect(m?.factoren.some(f=>f.categorie==='regio' && f.aard==='positief')).toBe(true);
 });
});
