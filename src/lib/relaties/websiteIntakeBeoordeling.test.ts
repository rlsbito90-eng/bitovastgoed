import { describe,expect,it } from 'vitest';
import { geldigeProvincies,redenenVoorBeoordeling,voorstelNieuweRelatie,zoekPlaatsenVoorstel,zoekRadiusVoorstel } from './websiteIntakeBeoordeling';
import type { ReviewIntake } from './websiteIntakeBeoordeling';
const base:ReviewIntake={
  applicant_name:'Voorbeeld Belegger',applicant_email:'belegger@example.net',applicant_phone:'0612345678',
  raw_payload:{fields:{
    company:'Voorbeeld BV','party-type':['Vastgoedbelegger'],
    'asset-types':['Residentieel vastgoed','Zorgvastgoed'],
    'investment-size':['€500.000 – €1.000.000'],
    'return-target':['6–8%','>10%'],'search-area':'Noord-Brabant',
    privacy:['1'],strategy:['Langjarige exploitatie'],
    'hard-criteria':'Minimaal 10 verhuureenheden',
  }},
};
const types=[
 {id:'woning-id',slug:'residentieel',name:'Woningen',sortOrder:1,isActive:true},
 {id:'zorg-id',slug:'zorg',name:'Zorgvastgoed',sortOrder:2,isActive:true},
];
describe('Fase 3D — website-beoordeling',()=>{
 it('vult nieuwe relatie volledig in, standaard Actief en zonder verzonnen BAR',()=>{
  const x=voorstelNieuweRelatie(base,types);
  expect(x).toMatchObject({
   bedrijfsnaam:'Voorbeeld BV',email:'belegger@example.net',
   partijprofiel:'belegger',type:'belegger',leadStatus:'actief',
   propertyTypeIds:['woning-id','zorg-id'],assetClasses:['wonen','zorgvastgoed'],
   regio:['Noord-Brabant'],budgetMin:500000,budgetMax:1000000,
   budgetVoorkeurToelichting:'€500.000 – €1.000.000',
   rendementsdoelToelichting:'6–8%; >10%',
   aankoopcriteria:'Minimaal 10 verhuureenheden',
  });
  expect(x.rendementseis).toBeUndefined();
 });
 it('leest vrije zoekradius als gestructureerd voorstel, niet als provincie',()=>{
  const input={...base,raw_payload:{fields:{...base.raw_payload.fields,'search-area':'35 km vanaf Amersfoort'}}};
  const x=voorstelNieuweRelatie(input,types);
  expect(x.regio).toEqual([]);
  expect(x.zoekgebiedToelichting).toBe('35 km vanaf Amersfoort');
  expect(x.zoekRadiusCentrum).toBe('Amersfoort');
  expect(x.zoekRadiusWaarde).toBe(35);
  expect(x.zoekRadiusEenheid).toBe('km_hemelsbreed');
  expect(redenenVoorBeoordeling(input,'nieuw_te_controleren').join(' ')).toContain('Zoekgebied');
 });
 it('stelt Apeldoorn en Deventer afzonderlijk voor zonder provincie te verzinnen',()=>{
  const input={...base,raw_payload:{fields:{...base.raw_payload.fields,'search-area':'Apeldoorn/ Deventer'}}};
  const x=voorstelNieuweRelatie(input,types);
  expect(x.regio).toEqual([]);
  expect(x.zoekPlaatsen).toEqual(['Apeldoorn','Deventer']);
  expect(x.zoekgebiedToelichting).toBe('Apeldoorn/ Deventer');
  expect(redenenVoorBeoordeling(input,'nieuw_te_controleren').join(' ')).toContain('Mogelijke zoekplaatsen');
  expect(zoekPlaatsenVoorstel('35 km vanaf Amersfoort / Utrecht')).toEqual([]);
  expect(zoekPlaatsenVoorstel('Apeldoorn en omgeving / Deventer')).toEqual([]);
  expect(zoekPlaatsenVoorstel('Gelderland / Overijssel')).toEqual([]);
 });
 it('laat meerdere budgetbanden letterlijk staan zonder numerieke gok',()=>{
  const input={...base,raw_payload:{fields:{...base.raw_payload.fields,
   'investment-size':['€100.000 – €500.000','€500.000 – €1.000.000']}}};
  const x=voorstelNieuweRelatie(input,types);
  expect(x.budgetMin).toBeUndefined();
  expect(x.budgetMax).toBeUndefined();
  expect(x.budgetVoorkeurToelichting).toContain('; ');
  expect(redenenVoorBeoordeling(input,'nieuw_te_controleren').join(' ')).toContain('Budget');
 });
 it('benoemt bestaande en dubbelzinnige contacten',()=>{
  expect(redenenVoorBeoordeling(base,'bestaande_relatie').join(' ')).toContain('bestaande relatie');
  expect(redenenVoorBeoordeling(base,'dubbelzinnig').join(' ')).toContain('dubbele relatie');
 });
 it('accepteert alleen officiële provincies als gestructureerde gebiedsselectie',()=>{
  expect(geldigeProvincies('Zuid-Holland, Noord-Brabant')).toEqual(['Zuid-Holland','Noord-Brabant']);
  expect(geldigeProvincies('Heel Nederland')).toEqual(['Heel Nederland']);
  expect(geldigeProvincies('Noord-Brabant, 35 km Amersfoort')).toEqual([]);
 });
 it('onderscheidt hemelsbrede kilometers van reistijd',()=>{
  expect(zoekRadiusVoorstel('35 km vanaf Amersfoort')).toEqual({
    zoekRadiusCentrum:'Amersfoort',zoekRadiusWaarde:35,zoekRadiusEenheid:'km_hemelsbreed'});
  expect(zoekRadiusVoorstel('Bergen op Zoom, max. 25 km')).toEqual({
    zoekRadiusCentrum:'Bergen op Zoom',zoekRadiusWaarde:25,zoekRadiusEenheid:'km_hemelsbreed'});
  expect(zoekRadiusVoorstel('maximale reistijd van 60 minuten vanaf Ede')).toEqual({
    zoekRadiusCentrum:'Ede',zoekRadiusWaarde:60,zoekRadiusEenheid:'minuten_reistijd'});
  expect(zoekRadiusVoorstel('Randstad en 30 minuten vanaf Ede')).toEqual({});
 });
});
