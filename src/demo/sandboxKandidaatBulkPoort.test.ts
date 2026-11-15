import {describe,expect,it} from 'vitest';
import {DEMO_BULK_OBJECT_ID,maakFictieveBulkPoort} from './sandboxKandidaatBulkPoort';
import {bouwKandidaatBulkVerzoek} from '@/lib/pipeline/kandidaatBulkContract';
import {voerBulkUit} from '@/lib/pipeline/kandidaatBulkUitvoering';
import {bouwKandidaatBulkHerstelVerzoek,voerBulkHerstelUit} from '@/lib/pipeline/kandidaatBulkHerstel';

const reqId='b4000000-0000-4000-8000-000000000001';
const maak=(g:ReturnType<typeof maakFictieveBulkPoort>,actie:{type:'interesse';niveau:'warm'|'zeer_warm'}={type:'interesse',niveau:'zeer_warm'})=>
 bouwKandidaatBulkVerzoek(DEMO_BULK_OBJECT_ID,reqId,[g.huidigeLijst()[0]],actie);
describe('Volledig fictieve testpoort voor transactionele kandidatenbulk',()=>{
 it('bewaart auditregels per gewijzigde kandidaat en laadt pas na opslaan nieuwe stand',async()=>{
   const g=maakFictieveBulkPoort(),verzoek=maak(g);
   const resultaat=await voerBulkUit(verzoek,g.poort);
   expect(resultaat.status).toBe('opgeslagen');
   expect(g.audit()).toHaveLength(1);
   expect(g.audit()[0]).toMatchObject({actie:'interesse',bron:null});
   expect(g.huidigeLijst()[0].interesseNiveau).toBe('zeer_warm');
 });
 it('verstoring na commit wordt hersteld met hetzelfde verzoek-ID zonder dubbel auditspoor',async()=>{
   const g=maakFictieveBulkPoort(),verzoek=maak(g);
   g.verbreekVolgendeVerbindingNaOpslaan();
   expect((await voerBulkUit(verzoek,g.poort)).status).toBe('onzeker');
   expect(g.audit()).toHaveLength(1);
   const tweede=await voerBulkUit(verzoek,g.poort);
   expect(tweede.status).toBe('opgeslagen');
   expect(g.audit()).toHaveLength(1);
 });
 it('versieconflict blokkeert de gehele batch',async()=>{
   const g=maakFictieveBulkPoort();
   const verzoek=bouwKandidaatBulkVerzoek(DEMO_BULK_OBJECT_ID,reqId,g.huidigeLijst().slice(0,2),{
     type:'interesse',niveau:'warm',
   });
   g.simuleerWijzigingVanuitAnderTabblad(g.huidigeLijst()[1].id);
   expect((await voerBulkUit(verzoek,g.poort)).status).toBe('conflict');
   expect(g.audit()).toHaveLength(0);
   expect(g.huidigeLijst()[0].interesseNiveau).toBe('warm');
   expect(g.huidigeLijst()[1].interesseNiveau).toBe('zeer_warm');
 });
 it('weigert hergebruik van hetzelfde verzoek-ID met een andere actie',async()=>{
   const g=maakFictieveBulkPoort();
   await g.poort.opslaan(maak(g));
   const anders=maak(g,{type:'interesse',niveau:'warm'});
   const status=await voerBulkUit(anders,g.poort);
   expect(status.status).toBe('geweigerd');
   expect(g.audit()).toHaveLength(1);
 });

 it('herstelt een volledige bulkactie, met nieuw auditspoor én idempotente retry',async()=>{
   const g=maakFictieveBulkPoort();
   const saved=await voerBulkUit(maak(g),g.poort);
   expect(saved.status).toBe('opgeslagen');
   const herstel=bouwKandidaatBulkHerstelVerzoek(DEMO_BULK_OBJECT_ID,reqId,'b4000000-0000-4000-8000-000000000020');
   const uitkomst=await voerBulkHerstelUit(herstel,g.herstelPoort);
   expect(uitkomst.status).toBe('hersteld');
   expect(g.huidigeLijst()[0].interesseNiveau).toBe('warm');
   expect(g.audit()).toHaveLength(2);
   expect(g.audit()[0].actie).toBe('interesse');
   expect(g.audit()[1].actie).toBe('herstel');
   expect(await g.herstelPoort.herstellen(herstel)).toMatchObject({hersteld:1});
   expect(g.audit()).toHaveLength(2);
   const nieuwId=bouwKandidaatBulkHerstelVerzoek(DEMO_BULK_OBJECT_ID,reqId,'b4000000-0000-4000-8000-000000000022');
   expect((await voerBulkHerstelUit(nieuwId,g.herstelPoort)).status).toBe('geweigerd');
 });
 it('weigert volledig herstel wanneer kandidaat ondertussen is aangepast',async()=>{
   const g=maakFictieveBulkPoort();
   await g.poort.opslaan(maak(g));
   const id=g.huidigeLijst()[0].id;
   g.simuleerWijzigingVanuitAnderTabblad(id);
   const result=await voerBulkHerstelUit(bouwKandidaatBulkHerstelVerzoek(DEMO_BULK_OBJECT_ID,reqId,'b4000000-0000-4000-8000-000000000020'),g.herstelPoort);
   expect(result.status).toBe('conflict');
   expect(g.audit()).toHaveLength(1);
   expect(g.huidigeLijst()[0].interesseNiveau).toBe('zeer_warm');
 });
});
