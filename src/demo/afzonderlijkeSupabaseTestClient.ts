import {createClient} from '@supabase/supabase-js';
import type {KandidaatBulkVerzoek,KandidaatBulkOpslagResultaat} from '@/lib/pipeline/kandidaatBulkContract';
import type {KandidaatBulkHerstelVerzoek,KandidaatBulkHerstelResultaat} from '@/lib/pipeline/kandidaatBulkHerstel';
import {
  maakAparteTestDatabasePoort,valideerAparteTestDatabase,
  type TestDatabaseConfiguratie,type TestDatabaseTransport,
  type TestPipelineKandidaat,
} from '@/lib/pipeline/kandidaatBulkTestDatabasePoort';
import {INTERESSE_LABELS,PIPELINE_FASES} from '@/data/mock-data';

/**
 * Voorbereid voor een NOG TE MAKEN Supabase-testproject.
 * WORDT NERGENS IN DE SANDBOX GEMOUNTEERD zolang er geen project,
 * testgebruiker en goedgekeurde testconfiguratie zijn.
 * Nooit importeren uit de bestaande productie-Supabase-client.
 */
export function maakGescheidenSupabaseTestClient(
  config:TestDatabaseConfiguratie,
  publishableKey:string,
  clientFactory:typeof createClient=createClient,
) {
  // Hard afbreken voordat een netwerk-capabele client bestaat.
  valideerAparteTestDatabase(config);
  if(!publishableKey.startsWith('sb_publishable_')||
     publishableKey.length<25 || /\s/.test(publishableKey))
    throw new Error('Gebruik uitsluitend een publishable key van het testproject.');
  const client=clientFactory(config.projectUrl,publishableKey,{
    auth:{
      storageKey:'bito-crm-test-'+config.projectRef,
      persistSession:true,
      autoRefreshToken:true,
    },
  });
  const transport:TestDatabaseTransport={
    async identiteit(){
      const {data,error}=await client.auth.getUser();
      if(error)throw error;
      if(!data.user)return null;
      return {id:data.user.id,isAnonymous:data.user.is_anonymous===true};
    },
    async rpcOpslaan(v:KandidaatBulkVerzoek){
      const {data,error}=await client.rpc('crm_pipeline_bulk_opslaan',v);
      if(error)throw error;
      return data as KandidaatBulkOpslagResultaat;
    },
    async rpcHerstellen(v:KandidaatBulkHerstelVerzoek){
      const {data,error}=await client.rpc('crm_pipeline_bulk_herstellen',v);
      if(error)throw error;
      return data as KandidaatBulkHerstelResultaat;
    },
    async objectFaseLezen(objectId:string){
      const {data,error}=await client.from('objecten')
        .select('id,pipeline_id,pipeline_stage_id,pipeline_stage_locked,pipeline_updated_at')
        .eq('id',objectId)
        .single();
      if(error)throw error;
      if(!data || typeof data.id!=='string' ||
         data.id.toLowerCase()!==objectId.toLowerCase())
        throw Error('Testproject gaf geen verifieerbare objectfase terug.');
      return {
        objectId:data.id,
        pipelineId:data.pipeline_id??null,
        stageId:data.pipeline_stage_id??null,
        locked:!!data.pipeline_stage_locked,
        updatedAt:data.pipeline_updated_at??null,
      };
    },
    async kandidatenLezen(objectId:string){
      const {data,error}=await client.from('object_pipeline')
        .select('id,object_id,pipeline_fase,interesse_niveau,updated_at')
        .eq('object_id',objectId)
        .is('soft_deleted_at',null);
      if(error)throw error;
      if(!Array.isArray(data))throw Error('Testdatabase gaf geen kandidatenlijst terug.');
      const geldigFase=new Set(PIPELINE_FASES.map(f=>f.key));
      const geldigInteresse=new Set(Object.keys(INTERESSE_LABELS));
      return data.map(row=>{
        if(!row||typeof row.id!=='string'||typeof row.object_id!=='string'||
           typeof row.updated_at!=='string'||
           !geldigFase.has(row.pipeline_fase) ||
           !geldigInteresse.has(row.interesse_niveau))
          throw Error('Testdatabase bevat een ongeldige kandidaatrij.');
        return {
          id:row.id,
          objectId:row.object_id,
          pipelineFase:row.pipeline_fase,
          interesseNiveau:row.interesse_niveau,
          updatedAt:row.updated_at,
        } as TestPipelineKandidaat;
      });
    },
  };
  return {
    client,
    ...maakAparteTestDatabasePoort(config,transport),
  };
}
