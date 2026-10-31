import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  isAanbiedbaar, maakKandidaatVoorstellen, maakKandidaatConcept,
  type CrmObjectInput, type CrmRelatieInput, type CrmMandaatInput
} from './rolMandaatAdapter';

const object=(x:Partial<CrmObjectInput>={}):CrmObjectInput=>({id:'o1',status:'beschikbaar',
  type:'wonen',propertyTypeId:'type-wonen',vraagprijs:450_000,
  plaats:'Breda',provincie:'Noord-Brabant',...x});
const relatie=(x:Partial<CrmRelatieInput>={}):CrmRelatieInput=>({id:'r1',type:'belegger',
  propertyTypeIds:['type-wonen'],budgetMax:700_000,...x});
const profiel=(x:Partial<CrmMandaatInput>={}):CrmMandaatInput=>({id:'z1',relatieId:'r1',status:'actief',
  propertyTypeIds:['type-wonen'],prijsMax:800_000,...x});
const voorstel=(o=object(),r:CrmRelatieInput[]= [relatie()],zs:CrmMandaatInput[]=[])=> maakKandidaatVoorstellen(o,r,zs);

test('beschikbaar is vereiste voor proactieve match',()=>{
 for(const status of ['te_beoordelen','on_hold','onder_optie','verkocht','ingetrokken','afgevallen']){
  assert.equal(isAanbiedbaar(object({status})),false,status);
  assert.equal(voorstel(object({status})).length,0);
 }
});
test('gearchiveerd en soft-verwijderd object wordt niet voorgesteld',()=>{
 assert.equal(voorstel(object({isArchived:true})).length,0);
 assert.equal(voorstel(object({softDeletedAt:'2026-10-30'})).length,0);
});
test('soft-verwijderde relatie wordt uitgesloten',()=>{
 assert.equal(voorstel(object(),[relatie({softDeletedAt:'2026-10-30'})]).length,0);
});
test('expliciete verkoper zonder koper of bemiddelaar wordt uitgesloten, ook met oude koopcriteria',()=>{
 assert.equal(voorstel(object(),[relatie({commercialRoles:['verkoper']})],[profiel()]).length,0);
});
test('eigenaar zonder zoekmandaat is niet automatisch koper',()=>{
 assert.equal(voorstel(object(),[relatie({type:'eigenaar',propertyTypeIds:['type-wonen']})]).length,0);
});
test('onbekende rol met oude beleggerscriteria blijft zichtbaar ter verificatie',()=>{
 const rows=voorstel();assert.equal(rows.length,1);
 assert.equal(rows[0].besteRoute.kwalificatie,'te_verifieren');
 assert.equal(rows[0].besteRoute.bevestiging,'te_verifieren');
});
test('expliciete lege rollen betekenen niet stiekem koper',()=>{
 assert.equal(voorstel(object(),[relatie({commercialRoles:[]})],[profiel()]).length,0);
});
test('belegger én verkoper met koperrol blijft direct matchbaar',()=>{
 const rows=voorstel(object(),[relatie({commercialRoles:['koper','verkoper']})]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.route,'directe_koper');
});
test('makelaar met oud zoekprofiel is bemiddelaar en niet de koper',()=>{
 const rows=voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined})],[profiel()]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.route,'via_bemiddelaar');
 assert.equal(rows[0].besteRoute.koperRelatieId,null);
});
test('gecontroleerd netwerkmandaat schrijft geen fictieve koper toe',()=>{
 const rows=voorstel(object(),[relatie({type:'makelaar',commercialRoles:['bemiddelaar']})],
 [profiel({mandateType:'voor_netwerk',mandateConfirmed:true})]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.koperRelatieId,null);
 assert.equal(rows[0].besteRoute.route,'via_bemiddelaar');
});
test('geverifieerde opdrachtgever alleen als deze bestaat en niet soft-verwijderd is',()=>{
 const broker=relatie({type:'makelaar',commercialRoles:['bemiddelaar']});
 const z=profiel({mandateType:'namens_opdrachtgever',mandateConfirmed:true,principalRelatieId:'buyer',principalVerified:true});
 let rows=voorstel(object(),[broker], [z]);assert.equal(rows[0].besteRoute.koperRelatieId,null);
 const buyer=relatie({id:'buyer'});
 rows=voorstel(object(),[broker,buyer],[z]);assert.equal(rows.find(x=>x.relatieId==='r1')?.besteRoute.koperRelatieId,'buyer');
 rows=voorstel(object(),[broker,{...buyer,softDeletedAt:'2026-10-01'}],[z]);
 assert.equal(rows[0].besteRoute.koperRelatieId,null);
});
test('zelfde contactrelatie met meerdere mandaten heeft één kandidatenrij',()=>{
 const rows=voorstel(object(),[relatie({type:'makelaar',commercialRoles:['koper','bemiddelaar']})],
 [profiel({mandateType:'eigen_aankoop',mandateConfirmed:true}),
  profiel({id:'z2',mandateType:'voor_netwerk',mandateConfirmed:true})]);
 assert.equal(rows.length,1);assert.equal(rows[0].alleRoutes.length,3);
 assert.equal(new Set(rows[0].alleRoutes.map(x=>x.key)).size,3);
});
test('gepauzeerd mandaat is niet actief',()=>{
 assert.equal(voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[]})],[profiel({status:'pauze'})]).length,0);
});
test('concept, verlopen, gearchiveerd mandaat geen voorstel',()=>{
 for(const status of ['concept','verlopen','gearchiveerd'])
  assert.equal(voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[]})],[profiel({status})]).length,0);
});
test('eigen aankoopmandaat zonder koperrol blokkeert',()=>{
 assert.equal(voorstel(object(),[relatie({type:'makelaar',commercialRoles:['bemiddelaar']})],
  [profiel({mandateType:'eigen_aankoop'})]).length,0);
});
test('bemiddelingmandaat zonder bemiddelaarrol blokkeert',()=>{
 assert.equal(voorstel(object(),[relatie({commercialRoles:['koper']})],
 [profiel({mandateType:'voor_netwerk'})]).length,1); // only relation base
 assert.equal(voorstel(object(),[relatie({commercialRoles:['koper']})],
 [profiel({mandateType:'voor_netwerk'})])[0].alleRoutes.length,1);
});
test('harde objecttype mismatch komt niet als standaardvoorstel',()=>{
 assert.equal(voorstel(object(),[relatie({propertyTypeIds:['type-kantoor']})]).length,0);
 assert.equal(maakKandidaatVoorstellen(object(),[relatie({propertyTypeIds:['type-kantoor']})],[],
  {toonAfwijkende:true})[0].besteRoute.kwalificatie,'afwijkend');
});
test('harde budgetmismatch komt niet als standaardvoorstel',()=>{
 assert.equal(voorstel(object(),[relatie({budgetMax:100_000})]).length,0);
});
test('onbekende prijs en postcode mogen geen bevestigde match creëren',()=>{
 const rows=voorstel(object({vraagprijs:null,propertyTypeId:null}),[relatie()]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.kwalificatie,'onvoldoende');
});
test('regio string wordt niet als nauwkeurige codevergelijking behandeld',()=>{
 const rows=voorstel(object(),[relatie({regio:['Randstad']})]);
 assert.ok(rows[0].besteRoute.toelichting.controleer.some(x=>x.includes('normaliseren')));
});
test('reeds gekoppelde relatie krijgt geen dubbel voorstel',()=>{
 assert.equal(maakKandidaatVoorstellen(object(),[relatie()],[],{reedsGekoppeld:new Set(['r1'])}).length,0);
});
test('handoff voor onbekend mandaat heeft geen DBACTIE of automatisch bod',()=>{
 const rows=voorstel();const draft=maakKandidaatConcept(object(),rows[0],rows[0].besteRoute.key);
 assert.equal(draft.ok,true);
 if(draft.ok){assert.equal(draft.concept.kanAutomatischVersturen,false);
 assert.equal(draft.concept.kanAutomatischBodMaken,false);
 assert.equal(draft.concept.gekozenMandaatId,null);}
});
test('handoff koppelt bestaand zoekprofiel via echte ID, niet virtuele ID',()=>{
 const rows=voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[]})],[profiel()]);
 const draft=maakKandidaatConcept(object(),rows[0],rows[0].besteRoute.key);
 assert.equal(draft.ok,true);
 if(draft.ok)assert.equal(draft.concept.gekozenMandaatId,'z1');
});
test('gekozen mandaat moet bestaan',()=>{
 const rows=voorstel();assert.equal(maakKandidaatConcept(object(),rows[0],'niet-bestaand').ok,false);
});
test('kandidaatvoorstellen veranderen bestaande inputs niet',()=>{
 const r=Object.freeze(relatie());const o=Object.freeze(object());const p=Object.freeze(profiel());
 const before=JSON.stringify([r,o,p]);maakKandidaatVoorstellen(o,[r],[p]);
 assert.equal(JSON.stringify([r,o,p]),before);
});
test('zoekprofiel wordt niet aangevuld met strijdig algemeen vastgoedtype',()=>{
 const r=relatie({commercialRoles:['koper'],propertyTypeIds:['type-kantoor'],budgetMax:200_000});
 const p=profiel({mandateType:'eigen_aankoop',mandateConfirmed:true,
   propertyTypeIds:undefined,typeVastgoed:['wonen'],prijsMax:800_000});
 const rows=voorstel(object(),[r],[p]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].besteRoute.zoekprofielId,'z1');
 assert.ok(rows[0].besteRoute.toelichting.matcht.includes('Legacy vastgoedtype komt overeen'));
});
test('zoekprofiel-budget is zelfstandig en krijgt geen hard maximum uit Relaties',()=>{
 const r=relatie({commercialRoles:['koper'],budgetMax:100_000});
 const p=profiel({mandateType:'eigen_aankoop',mandateConfirmed:true,
   prijsMax:1_000_000});
 const rows=voorstel(object(),[r],[p]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].besteRoute.zoekprofielId,'z1');
});
test('nog lege profielregio mag niet automatische relatie-regio erven',()=>{
 const r=relatie({commercialRoles:['koper'],regio:['Utrecht']});
 const p=profiel({mandateType:'eigen_aankoop',mandateConfirmed:true,regio:[]});
 const rows=voorstel(object(),[r],[p]);
 const active=rows[0].alleRoutes.find(x=>x.zoekprofielId==='z1');
 assert.ok(active);
 assert.ok(active?.toelichting.controleer.includes('Aankoopregio ontbreekt'));
});
test('legacy directe contactrelatie is geen geverifieerde economische koper',()=>{
 const rows=voorstel();assert.equal(rows[0].besteRoute.koperRelatieId,null);
 const handoff=maakKandidaatConcept(object(),rows[0],rows[0].besteRoute.key);
 assert.equal(handoff.ok,true);
 if(handoff.ok)assert.equal(handoff.concept.koperRelatieId,null);
});
test('bevestigde koperrol geeft pas een koperreferentie bij directe relatiecriteria',()=>{
 const rows=voorstel(object(),[relatie({commercialRoles:['koper']})]);
 assert.equal(rows[0].besteRoute.koperRelatieId,'r1');
});