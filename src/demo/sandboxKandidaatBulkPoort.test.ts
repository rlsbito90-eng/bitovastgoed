import {describe,expect,it} from 'vitest';
import {DEMO_BULK_OBJECT_ID,maakFictieveBulkPoort} from './sandboxKandidaatBulkPoort';
import {bouwKandidaatBulkVerzoek} from '@/lib/pipeline/kandidaatBulkContract';
import {voerBulkUit} from '@/lib/pipeline/kandidaatBulkUitvoering';

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
});
