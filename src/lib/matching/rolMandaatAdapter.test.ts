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
test('verkoper zonder relevante aankoopcriteria komt niet naar voren',()=>{
 const r=relatie({type:'eigenaar',commercialRoles:['verkoper'],propertyTypeIds:[],budgetMax:undefined});
 assert.equal(voorstel(object(),[r]).length,0);
});
test('eigenaar zonder zoekmandaat is niet automatisch koper',()=>{
 assert.equal(voorstel(object(),[relatie({type:'eigenaar',propertyTypeIds:['type-wonen']})]).length,0);
});
test('onbekende rol met oude beleggerscriteria blijft zichtbaar ter verificatie',()=>{
 const rows=voorstel();assert.equal(rows.length,1);
 assert.equal(rows[0].besteRoute.kwalificatie,'passend');
 assert.equal(rows[0].besteRoute.bevestiging,'te_verifieren');
});
test('actief zoekprofiel maakt contact direct matchbaar ook zonder vastgelegde rol',()=>{
 const r=relatie({commercialRoles:[],propertyTypeIds:[],budgetMax:undefined});
 const rows=voorstel(object(),[r],[profiel()]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.koperRelatieId,null);
});
test('belegger én verkoper met koperrol blijft direct matchbaar',()=>{
 const rows=voorstel(object(),[relatie({commercialRoles:['koper','verkoper']})]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.route,'directe_partij');
});
test('makelaar met oud zoekprofiel is bemiddelaar en niet de koper',()=>{
 const rows=voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined})],[profiel()]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.route,'directe_partij');
 assert.equal(rows[0].besteRoute.koperRelatieId,null);
});
test('gecontroleerd netwerkmandaat schrijft geen fictieve koper toe',()=>{
 const rows=voorstel(object(),[relatie({type:'makelaar',commercialRoles:['bemiddelaar']})],
 [profiel({mandateType:'voor_netwerk',mandateConfirmed:true})]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.koperRelatieId,null);
 assert.equal(rows[0].besteRoute.route,'directe_partij');
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
 assert.equal(voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined})],[profiel({status:'pauze'})]).length,0);
});
test('concept, verlopen, gearchiveerd mandaat geen voorstel',()=>{
 for(const status of ['concept','verlopen','gearchiveerd'])
  assert.equal(voorstel(object(),[relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined})],[profiel({status})]).length,0);
});
test('makelaar kan een eigen aankoopprofiel hebben zonder koperrol of mandaatbewijs',()=>{
 const r=relatie({type:'makelaar',commercialRoles:['bemiddelaar'],propertyTypeIds:[],budgetMax:undefined});
 const rows=voorstel(object(),[r],[profiel({mandateType:'eigen_aankoop'})]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.koperRelatieId,null);
});
test('zoekprofiel wordt benut ongeacht onbekend mandaat of commerciële rol',()=>{
 const rows=voorstel(object(),[relatie({commercialRoles:['koper']})],[profiel({mandateType:'voor_netwerk'})]);
 assert.equal(rows.length,1);assert.equal(rows[0].alleRoutes.length,2);
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
 assert.ok(rows[0].besteRoute.toelichting.controleer.some(x=>x.includes('Zoekregio')));
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
 assert.ok(rows[0].besteRoute.toelichting.matcht.includes('Vastgoedtype komt overeen'));
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
 assert.ok(!active?.toelichting.controleer.some(x=>x.includes('Zoekregio')));
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

test('gelijke matchkwaliteit wordt niet op mandaatstatus gerangschikt',()=>{
 const b=relatie({id:'b',type:'makelaar',commercialRoles:['bemiddelaar'],
   propertyTypeIds:[],budgetMax:undefined});
 const onduidelijk=profiel({id:'z-onduidelijk',relatieId:'b',naam:'A netwerk',
   mandateType:'voor_netwerk',mandateConfirmed:false});
 const bevestigd=profiel({id:'z-bevestigd',relatieId:'b',naam:'Z bevestigd',
   mandateType:'namens_opdrachtgever',mandateConfirmed:true});
 for(const input of [[onduidelijk,bevestigd],[bevestigd,onduidelijk]]){
   const rows=voorstel(object(),[b],input);
   assert.equal(rows.length,1);
   assert.equal(rows[0].alleRoutes.length,2);
   assert.equal(rows[0].besteRoute.zoekprofielId,'z-onduidelijk');
 }
});

// Aanvullende praktijkgevallen: een contactpartij is geen bewezen eindkoper.
test('makelaar met alleen algemene criteria is directe kandidaat zonder mandaat',()=>{
 const r=relatie({type:'makelaar',commercialRoles:undefined,propertyTypeIds:['type-wonen'],budgetMax:600_000});
 const rows=voorstel(object(),[r]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.route,'directe_partij');
 assert.equal(rows[0].besteRoute.kwalificatie,'passend');assert.equal(rows[0].besteRoute.koperRelatieId,null);
});
test('makelaar met enkel een breed profiel zonder mandaat wordt gematcht',()=>{
 const r=relatie({type:'makelaar',commercialRoles:['bemiddelaar'],propertyTypeIds:[],budgetMax:undefined});
 const rows=voorstel(object(),[r],[profiel({mandateType:undefined,mandateConfirmed:undefined,prijsMax:undefined})]);
 assert.equal(rows.length,1);assert.equal(rows[0].alleRoutes.length,1);
 assert.equal(rows[0].besteRoute.kwalificatie,'passend');
});
test('leeg profiel en lege relatiecriteria zijn geen match',()=>{
 const r=relatie({type:'makelaar',propertyTypeIds:[],assetClasses:[],regio:[],budgetMax:undefined});
 const p=profiel({propertyTypeIds:[],typeVastgoed:[],regio:[],prijsMax:undefined});
 assert.equal(voorstel(object(),[r],[p]).length,0);
});
test('landelijke brede zoekregio is een match zonder budget of type',()=>{
 const r=relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined,regio:['Heel Nederland']});
 assert.equal(voorstel(object(),[r])[0].besteRoute.kwalificatie,'passend');
});
test('de provincie matcht en een onzekere regiobenaming blokkeert niet hard',()=>{
 const r=relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined,regio:['Noord-Brabant']});
 assert.equal(voorstel(object(),[r])[0].besteRoute.kwalificatie,'passend');
 const m=relatie({type:'makelaar',propertyTypeIds:[],budgetMax:undefined,regio:['Randstad']});
 assert.equal(voorstel(object(),[m])[0].besteRoute.kwalificatie,'onvoldoende');
});
test('breed profiel wijkt af van basiscriteria zonder mandaat als uitsluiter',()=>{
 const r=relatie({type:'makelaar',propertyTypeIds:['type-kantoor'],budgetMax:100000});
 const p=profiel({propertyTypeIds:['type-wonen'],prijsMax:900000,mandateConfirmed:false});
 const rows=voorstel(object(),[r],[p]);
 assert.equal(rows.length,1);assert.equal(rows[0].besteRoute.zoekprofielId,p.id);
 assert.equal(rows[0].besteRoute.kwalificatie,'passend');
 assert.ok(!rows[0].besteRoute.toelichting.controleer.some(x=>x.includes('mandaat')));
});

// Gemeente is bestuurlijk en hoeft niet gelijk te zijn aan de woonplaats.
test('gemeente De Ronde Venen bij object in Mijdrecht vergt geverifieerde gemeentenaam',()=>{
 const r=relatie({id:'broker',type:'makelaar',propertyTypeIds:[],budgetMax:undefined});
 const p=profiel({id:'z-gm',relatieId:'broker',propertyTypeIds:[],prijsMax:undefined,
   regio:['Utrecht'],steden:['gemeente:De Ronde Venen']});
 const onbekend=voorstel(object({plaats:'Mijdrecht',provincie:'Utrecht',gemeente:undefined}),[r],[p]);
 assert.equal(onbekend.length,1); assert.equal(onbekend[0].besteRoute.kwalificatie,'onvoldoende');
 assert.ok(onbekend[0].besteRoute.toelichting.controleer.some(x=>x.includes('Gemeente van object onbekend')));
 const bevestigd=voorstel(object({plaats:'Mijdrecht',provincie:'Utrecht',gemeente:'De Ronde Venen'}),[r],[p]);
 assert.equal(bevestigd[0].besteRoute.kwalificatie,'passend');
});
test('bekende gemeente buiten zoekprofiel wordt niet als passend gepresenteerd',()=>{
 const r=relatie({id:'r1',type:'makelaar',propertyTypeIds:[],budgetMax:undefined});
 const p=profiel({regio:['Noord-Brabant'],steden:['gemeente:Oisterwijk'],propertyTypeIds:[],prijsMax:undefined});
 const rows=voorstel(object({plaats:'Tilburg',gemeente:'Tilburg',provincie:'Noord-Brabant'}),[r],[p]);
 assert.equal(rows.length,0);
});
test('oude vrije plaatsnaam blijft een plaatsfilter',()=>{
 const r=relatie({id:'r1',type:'makelaar',propertyTypeIds:[],budgetMax:undefined});
 const p=profiel({regio:['Utrecht'],steden:['Breda'],propertyTypeIds:[],prijsMax:undefined});
 assert.equal(voorstel(object({plaats:'Breda',provincie:'Noord-Brabant'}),[r],[p])[0].besteRoute.kwalificatie,'passend');
});
