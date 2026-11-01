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

 it('A15.3: ontwikkelaar kan ook bemiddelaar zijn zonder automatisch economische koper te worden',()=>{
   const r=relatie({type:'ontwikkelaar',partijprofiel:'ontwikkelaar',commercialRoles:['bemiddelaar']});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.huidigeKandidaatKoppelingen).toBe(1);
   expect(d.gesimuleerdeKandidaatKoppelingen).toBe(1);
   expect(d.verdwenenKoppelingen).toBe(0);
   expect(d.veranderdeBevestigingen).toBe(1);
   expect(d.verschillen[0].oud?.besteRoute.koperRelatieId).toBeNull();
   expect(d.verschillen[0].nieuw?.besteRoute.koperRelatieId).toBeNull();
 });
 it('A15.3: ontwikkelende belegger met vastgelegde koperrol mag bij overgang geen koperidentiteit verliezen',()=>{
   const r=relatie({type:'ontwikkelaar',partijprofiel:'ontwikkelende_belegger',commercialRoles:['koper']});
   const d=vergelijkMatchBeleid([object()],[r],[]);
   expect(d.huidigeKandidaatKoppelingen).toBe(1);
   expect(d.gesimuleerdeKandidaatKoppelingen).toBe(1);
   expect(d.veranderdeKoperidentiteiten).toBe(1);
   expect(d.verschillen[0].oud?.besteRoute.koperRelatieId).toBe('r1');
   expect(d.verschillen[0].nieuw?.besteRoute.koperRelatieId).toBeNull();
 });
 it('A15.5 registreert een bestaande kandidaat zelfs wanneer beide matchingmodellen die missen',()=>{
   const r=relatie({type:'eigenaar',partijprofiel:null,propertyTypeIds:[],assetClasses:[],budgetMax:undefined});
   const d=vergelijkMatchBeleid([object()],[r],[],[
     {id:'pipeline-1',objectId:'o1',relatieId:'r1',pipelineFase:'indicatieve_bieding'},
   ]);
   expect(d.verschillen).toHaveLength(0);
   expect(d.pipelineZonderGegenereerdeMatch).toBe(1);
   expect(d.pipelineTeBeoordelen).toBe(1);
   expect(d.pipelineControles[0]).toMatchObject({
     pipelineId:'pipeline-1',status:'geen_match',pipelineFase:'indicatieve_bieding',
     relatieId:'r1',objectId:'o1',partijprofielOntbreekt:true,
   });
 });
 it('A15.5 bewaakt een bestaande route die in de simulatie wegvalt',()=>{
   const r=relatie({partijprofiel:null});
   const d=vergelijkMatchBeleid([object()],[r],[],[
     {objectId:'o1',relatieId:'r1',pipelineFase:'match_gevonden'},
   ]);
   expect(d.pipelineWegvallendeRoutes).toBe(1);
   expect(d.pipelineControles[0].status).toBe('valt_weg');
   expect(d.lopendePipelineMetVerschil).toBe(1);
 });
 it('A15.5 markeert gewijzigde koperverwijzingen zonder feitelijk koperrecord te wijzigen',()=>{
   const r=Object.freeze(relatie({partijprofiel:'ontwikkelende_belegger',commercialRoles:['koper']}));
   const p=Object.freeze({id:'p1',objectId:'o1',relatieId:'r1',pipelineFase:'informatie_gedeeld' as const});
   const before=JSON.stringify([r,p]);
   const d=vergelijkMatchBeleid([object()],[r],[],[p]);
   expect(d.pipelineGewijzigdeKoperverwijzingen).toBe(1);
   expect(d.pipelineControles[0]).toMatchObject({
     status:'koperverwijzing',huidigeKoperRelatieId:'r1',nieuweKoperRelatieId:null,
   });
   expect(JSON.stringify([r,p])).toBe(before);
 });
 it('A15.5 toont actieve kandidaat op on-hold object zonder nieuwe match aan te maken',()=>{
   const d=vergelijkMatchBeleid([object({status:'on_hold'})],[relatie()],[],[
     {objectId:'o1',relatieId:'r1',pipelineFase:'indicatieve_bieding'},
   ]);
   expect(d.beschikbareObjecten).toBe(0);
   expect(d.lopendePipelineBuitenVergelijking).toBe(1);
   expect(d.pipelineControles[0].status).toBe('buiten_vergelijking');
   expect(d.huidigeKandidaatKoppelingen).toBe(0);
 });
 it('A15.5 registreert onbekende classificatie ook wanneer matches verder gelijk blijven',()=>{
   const r=relatie({type:'eigenaar',partijprofiel:null,propertyTypeIds:[],budgetMax:undefined});
   const d=vergelijkMatchBeleid([object()],[r],[profiel()],[
     {objectId:'o1',relatieId:'r1',pipelineFase:'teaser_verstuurd'},
   ]);
   expect(d.verschillen).toHaveLength(0);
   expect(d.pipelineControles[0].status).toBe('profiel_ontbreekt');
 });
 it('A15.5 telt afgewezen en afgeronde dossiers niet als lopende pipeline',()=>{
   const d=vergelijkMatchBeleid([object()],[relatie()],[],[
     {objectId:'o1',relatieId:'r1',pipelineFase:'afgevallen'},
     {objectId:'o1',relatieId:'r1',pipelineFase:'afgerond'},
   ]);
   expect(d.lopendePipelineKoppelingen).toBe(0);
   expect(d.pipelineControles).toHaveLength(0);
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
