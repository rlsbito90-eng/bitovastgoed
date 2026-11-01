import {describe,it,expect} from 'vitest';
import {
  maakKandidaatVoorstellen,
  type CrmObjectInput,type CrmRelatieInput,type CrmMandaatInput,
} from './rolMandaatAdapter';
import {vergelijkMatchBeleid} from './a15ImpactPreview';

const object=(x:Partial<CrmObjectInput>={}):CrmObjectInput=>({
  id:'o1',status:'beschikbaar',type:'wonen',
  propertyTypeId:'type-wonen',vraagprijs:450000,
  plaats:'Breda',provincie:'Noord-Brabant',...x,
});
const relatie=(x:Partial<CrmRelatieInput>={}):CrmRelatieInput=>({
  id:'r1',type:'belegger',propertyTypeIds:['type-wonen'],budgetMax:700000,...x,
});
const profiel=(x:Partial<CrmMandaatInput>={}):CrmMandaatInput=>({
  id:'z1',relatieId:'r1',status:'actief',
  propertyTypeIds:['type-wonen'],prijsMax:700000,...x,
});
describe('A15 matchingvergelijking zonder databasewijziging',()=>{
 it('houdt het bestaande matchbeleid standaard ongewijzigd',()=>{
   const r=relatie({commercialRoles:['koper']});
   const oud=maakKandidaatVoorstellen(object(),[r],[]);
   const exp=maakKandidaatVoorstellen(object(),[r],[],{beleid:'bestaand'});
   expect(oud).toEqual(exp);
   expect(oud[0].besteRoute.koperRelatieId).toBe('r1');
 });
 it('merkt terecht ontbrekende classificaties aan als toekomstige uitval',()=>{
   const r=relatie({partijprofiel:null});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.beschikbareObjecten).toBe(1);
   expect(d.huidigeKandidaatKoppelingen).toBe(1);
   expect(d.gesimuleerdeKandidaatKoppelingen).toBe(0);
   expect(d.verdwenenKoppelingen).toBe(1);
   expect(d.objectenMetVerschil).toBe(1);
 });
 it('kan een expliciete Family office met algemene criteria blijven matchen',()=>{
   const r=relatie({type:'eigenaar',partijprofiel:'family_office',commercialRoles:null});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.huidigeKandidaatKoppelingen).toBe(0);
   expect(d.gesimuleerdeKandidaatKoppelingen).toBe(1);
   expect(d.nieuweKoppelingen).toBe(1);
 });
 it('actief Zoekprofiel blijft matchbaar ongeacht beleggerslabel of koperrol',()=>{
   const r=relatie({type:'eigenaar',partijprofiel:null,commercialRoles:null,
     propertyTypeIds:[],budgetMax:undefined});
   const d=vergelijkMatchBeleid([object()],[r],[profiel()]);
   expect(d.huidigeKandidaatKoppelingen).toBe(1);
   expect(d.gesimuleerdeKandidaatKoppelingen).toBe(1);
   expect(d.verdwenenKoppelingen).toBe(0);
 });
 it('makelaar wordt niet als economische koper afgeleid en mandaat is geen voorwaarde',()=>{
   const r=relatie({type:'makelaar',partijprofiel:'makelaar',commercialRoles:['bemiddelaar']});
   const matches=maakKandidaatVoorstellen(object(),[r],[],{beleid:'profiel_eerst'});
   expect(matches).toHaveLength(1);
   expect(matches[0].besteRoute.koperRelatieId).toBeNull();
   expect(matches[0].besteRoute.bevestiging).toBe('te_verifieren');
 });
 it('de bestaande koperrol wordt niet stilzwijgend als koperidentiteit overgenomen',()=>{
   const r=relatie({partijprofiel:'belegger',commercialRoles:['koper']});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.veranderdeKoperidentiteiten).toBe(1);
   expect(d.verdwenenKoppelingen).toBe(0);
 });
 it('toont per verdwenen koppeling object, relatie en concrete reden',()=>{
   const d=vergelijkMatchBeleid([object()],[relatie({partijprofiel:null})],[]);
   expect(d.verschillen).toHaveLength(1);
   expect(d.verschillen[0]).toMatchObject({
     objectId:'o1',relatieId:'r1',soort:'weggevallen',nieuw:null,
   });
   expect(d.verschillen[0].oud?.besteRoute.bron).toBe('relatie_basis');
   expect(d.verschillen[0].redenen.join(' ')).toContain('Partijprofiel ontbreekt');
 });
 it('beschrijft nieuwe contactroute zonder mandaat of automatische koperclaim',()=>{
   const r=relatie({type:'eigenaar',partijprofiel:'family_office'});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.verschillen).toHaveLength(1);
   expect(d.verschillen[0].soort).toBe('nieuw');
   expect(d.verschillen[0].nieuw?.besteRoute.koperRelatieId).toBeNull();
   expect(d.verschillen[0].redenen.join(' ')).toContain('geen opdracht');
 });
 it('wijziging aan koperidentiteit en bevestiging is zichtbaar, ook als kandidaat blijft',()=>{
   const r=relatie({partijprofiel:'belegger',commercialRoles:['koper']});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.verdwenenKoppelingen).toBe(0);
   expect(d.nieuweKoppelingen).toBe(0);
   expect(d.objectenMetVerschil).toBe(1);
   expect(d.veranderdeKoperidentiteiten).toBe(1);
   expect(d.veranderdeBevestigingen).toBe(1);
   expect(d.verschillen).toHaveLength(1);
   expect(d.verschillen[0].soort).toBe('gewijzigd');
   expect(d.verschillen[0].redenen.join(' ')).toContain('economische koper');
 });
 it('bewaakt een lopende pipeline afzonderlijk, ook op niet-beschikbare objecten',()=>{
   const r=relatie({partijprofiel:null});
   const d=vergelijkMatchBeleid([object(),object({id:'o2',status:'verkocht'})],[r],[],[
     {objectId:'o1',relatieId:'r1',pipelineFase:'teaser_verstuurd'},
     {objectId:'o2',relatieId:'r1',pipelineFase:'informatie_gedeeld'},
     {objectId:'o1',relatieId:'r1',pipelineFase:'afgevallen'},
   ]);
   expect(d.lopendePipelineKoppelingen).toBe(2);
   expect(d.relatiesMetLopendePipelineZonderProfiel).toBe(1);
   expect(d.lopendePipelineBuitenVergelijking).toBe(1);
   expect(d.lopendePipelineMetVerschil).toBe(1);
 });
 it('meldt geen veranderingen bij twee identieke kandidaatsets',()=>{
   const r=relatie({type:'makelaar',partijprofiel:'makelaar',commercialRoles:null,propertyTypeIds:[],budgetMax:undefined});
   const d=vergelijkMatchBeleid([object()],[r],[profiel()]);
   expect(d.verschillen).toHaveLength(0);
   expect(d.veranderdeKoperidentiteiten).toBe(0);
   expect(d.objectenMetVerschil).toBe(0);
 });
 it('gearchiveerde of niet-beschikbare objecten tellen niet mee; inputs blijven onveranderd',()=>{
   const o=Object.freeze(object({status:'verkocht'}));
   const r=Object.freeze(relatie({partijprofiel:'fonds'}));
   const b=JSON.stringify([o,r]);
   const d=vergelijkMatchBeleid([o],[r],[]);
   expect(d.beschikbareObjecten).toBe(0);
   expect(d.huidigeKandidaatKoppelingen).toBe(0);
   expect(JSON.stringify([o,r])).toBe(b);
 });
});
