import {describe,expect,it,vi} from 'vitest';
import {voerBulkUit} from './kandidaatBulkUitvoering';
import type {KandidaatBulkVerzoek,KandidaatBulkOpslagResultaat} from './kandidaatBulkContract';
const p:KandidaatBulkVerzoek={
 p_object_id:'b1000000-0000-4000-8000-000000000001',
 p_request_id:'b4000000-0000-4000-8000-000000000002',
 p_items:[{id:'b2000000-0000-4000-8000-000000000001',expected_updated_at:'2026-11-15T08:00:00Z'}],
 p_actie:{type:'interesse',niveau:'warm'},
};
const r:KandidaatBulkOpslagResultaat={
 verzoek_id:p.p_request_id,aangepast:1,ongewijzigd:0,
 wijzigingen:[{id:p.p_items[0].id,updated_at:'2026-11-15T10:00:00.000001Z'}],
};
describe('Aansluiten bulkopslag met veilige herhaalstrategie',()=>{
 it('toont pas nieuwe CRM-data nadat server succes meldt en de lijst vernieuwt',async()=>{
   const opslaan=vi.fn().mockResolvedValue(r),ververs=vi.fn().mockResolvedValue([{id:'nieuwe staat'}]);
   expect(await voerBulkUit(p,{opslaan,ververs})).toMatchObject({status:'opgeslagen',kandidaten:[{id:'nieuwe staat'}]});
   expect(opslaan).toHaveBeenCalledTimes(1);
   expect(ververs).toHaveBeenCalledWith(p.p_object_id);
 });
 it('bewaart bij netwerkuitval dezelfde verzoek-ID en voorkomt verzonnen succes',async()=>{
   const ververs=vi.fn();
   const result=await voerBulkUit(p,{opslaan:async()=>{throw new Error('network reset');},ververs});
   expect(result.status).toBe('onzeker');
   if(result.status==='onzeker')expect(result.verzoek).toBe(p);
   expect(ververs).not.toHaveBeenCalled();
 });
 it('behandelt versieconflict zonder tweede opslagpoging',async()=>{
   const ververs=vi.fn();
   const result=await voerBulkUit(p,{opslaan:async()=>{throw {code:'40001'};},ververs});
   expect(result.status).toBe('conflict');
   expect(ververs).not.toHaveBeenCalled();
 });
 it('meldt bevestigde opslag met mislukte verversing anders dan netwerkuitval',async()=>{
   const result=await voerBulkUit(p,{opslaan:async()=>r,ververs:async()=>{throw Error('timeout');}});
   expect(result.status).toBe('opgeslagen_niet_ververst');
 });
 it('weigert onbetrouwbare of dubbele responsrecords zonder client-success',async()=>{
   const bad={...r,wijzigingen:[{id:'b2000000-0000-4000-8000-000000000099',updated_at:'2026-11-15T10:00:00Z'}]};
   const result=await voerBulkUit(p,{opslaan:async()=>bad,ververs:async()=>[]});
   expect(result.status).toBe('onzeker');
 });
 it('maakt geen vals conflict bij autorisatiefout en behandelt dit als weigering',async()=>{
   const result=await voerBulkUit(p,{opslaan:async()=>{throw {code:'42501'};},ververs:async()=>[]});
   expect(result.status).toBe('geweigerd');
 });

 it('accepteert alleen canonieke vooruitgang van de objectfase bij echte kandidaatfase-update',async()=>{
   const faseVerzoek={...p,p_actie:{type:'fase' as const,fase:'bezichtiging_gepland' as const}};
   const objectFase={
     object_id:p.p_object_id,
     oude_stage_id:'b6000000-0000-4000-8000-000000000040',
     nieuwe_stage_id:'b6000000-0000-4000-8000-000000000070',
     nieuwe_slug:'bezichtigingen',
   };
   const succes=await voerBulkUit(faseVerzoek,{
     opslaan:async()=>({...r,object_fase_wijziging:objectFase}),
     ververs:async()=>[],
   });
   expect(succes.status).toBe('opgeslagen');

   for(const afwijking of [
     {...objectFase,nieuwe_slug:'afgerond'},
     {...objectFase,object_id:'b1000000-0000-4000-8000-000000000099'},
     {...objectFase,nieuwe_stage_id:objectFase.oude_stage_id},
   ]){
     const verkeerd=await voerBulkUit(faseVerzoek,{
       opslaan:async()=>({...r,object_fase_wijziging:afwijking}),
       ververs:async()=>[],
     });
     expect(verkeerd.status).toBe('onzeker');
   }
   const interestVerkeerd=await voerBulkUit(p,{
     opslaan:async()=>({...r,object_fase_wijziging:objectFase}),
     ververs:async()=>[],
   });
   expect(interestVerkeerd.status).toBe('onzeker');
 });
});
