import {describe,expect,it,vi} from 'vitest';
import type {createClient} from '@supabase/supabase-js';
import {maakGescheidenSupabaseTestClient} from './afzonderlijkeSupabaseTestClient';
import type {TestDatabaseConfiguratie} from '@/lib/pipeline/kandidaatBulkTestDatabasePoort';

const projectRef='bbbbbbbbbbbbbbbbbbbb';
const config:TestDatabaseConfiguratie={
  hostname:'bitovastgoed-git-crm-test-bitovastgoed.vercel.app',
  enabled:true,
  projectRef,
  projectUrl:'https://'+projectRef+'.supabase.co',
  productieProjectUrl:'https://vyjocdlwfxrblusfngfq.supabase.co',
};
const key='sb_publishable_'+ 'x'.repeat(48);
const objectId='b1000000-0000-4000-8000-000000000001';
const pipelineId='b2000000-0000-4000-8000-000000000001';
const requestId='b4000000-0000-4000-8000-000000000001';
const herstelId='b4000000-0000-4000-8000-000000000002';

function fakeClient(){
  const getUser=vi.fn().mockResolvedValue({data:{user:{
    id:'11111111-1111-1111-1111-111111111111',is_anonymous:false,
  }},error:null});
  const rpc=vi.fn().mockImplementation(async(name:string)=>{
    if(name==='crm_pipeline_bulk_opslaan')
      return {data:{verzoek_id:requestId,aangepast:1,ongewijzigd:0,
        wijzigingen:[{id:pipelineId,updated_at:'2026-11-15T13:00:00.000001+00:00'}]},error:null};
    return {data:{herstel_request_id:herstelId,bron_request_id:requestId,hersteld:1,
      wijzigingen:[{id:pipelineId,updated_at:'2026-11-15T14:00:00.000001+00:00'}]},error:null};
  });
  const is=vi.fn().mockResolvedValue({data:[{
    id:pipelineId,object_id:objectId,pipeline_fase:'match_gevonden',
    interesse_niveau:'lauw',updated_at:'2026-11-15T08:00:00.000001+00:00',
  }],error:null});
  const single=vi.fn().mockResolvedValue({data:{
    id:objectId,pipeline_id:'b5000000-0000-4000-8000-000000000001',
    pipeline_stage_id:'b6000000-0000-4000-8000-000000000070',
    pipeline_stage_locked:false,
    pipeline_updated_at:'2026-11-15T13:30:00Z',
  },error:null});
  const eq=vi.fn().mockReturnValue({is,single});
  const select=vi.fn().mockReturnValue({eq});
  const from=vi.fn().mockReturnValue({select});
  const mock={auth:{getUser},rpc,from};
  const factory=vi.fn().mockReturnValue(mock) as unknown as typeof createClient;
  return {mock,factory,getUser,rpc,from,select,eq,is,single};
}
describe('Supabase transport: uitsluitend afzonderlijk testproject, niet actief zonder configuratie',()=>{
  it('maakt zelfs geen client aan als projectref of host naar productie wijst',()=>{
    const a=fakeClient();
    expect(()=>maakGescheidenSupabaseTestClient({
      ...config,projectRef:'vyjocdlwfxrblusfngfq',
      projectUrl:'https://vyjocdlwfxrblusfngfq.supabase.co',
    },key,a.factory)).toThrow();
    expect(()=>maakGescheidenSupabaseTestClient({
      ...config,hostname:'bitovastgoed.nl',
    },key,a.factory)).toThrow();
    expect(a.factory).not.toHaveBeenCalled();
  });
  it('wijst service keys en ontbrekende publishable keys af vóór clientcreatie',()=>{
    const a=fakeClient();
    for(const bad of ['','sb_secret_xxx','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'sb_publishable_abc'])
      expect(()=>maakGescheidenSupabaseTestClient(config,bad,a.factory)).toThrow(/publishable key/);
    expect(a.factory).not.toHaveBeenCalled();
  });
  it('maakt een eigen Supabase-client met aparte Auth-opslag en roept alleen test-RPCs aan',async()=>{
    const a=fakeClient();
    const p=maakGescheidenSupabaseTestClient(config,key,a.factory);
    expect(a.factory).toHaveBeenCalledWith(config.projectUrl,key,{
      auth:{
        storageKey:'bito-crm-test-'+projectRef,
        persistSession:true,autoRefreshToken:true,
      },
    });
    const saved=await p.bulk.opslaan({
      p_object_id:objectId,p_request_id:requestId,
      p_items:[{id:pipelineId,expected_updated_at:'2026-11-15T08:00:00.000001+00:00'}],
      p_actie:{type:'interesse',niveau:'warm'},
    });
    expect(saved.aangepast).toBe(1);
    expect(a.rpc).toHaveBeenCalledWith('crm_pipeline_bulk_opslaan',expect.objectContaining({
      p_request_id:requestId,
    }));
    const herstel=await p.herstel.herstellen({
      p_object_id:objectId,p_bron_request_id:requestId,p_herstel_request_id:herstelId,
    });
    expect(herstel.hersteld).toBe(1);
    expect(a.rpc).toHaveBeenCalledWith('crm_pipeline_bulk_herstellen',expect.objectContaining({
      p_herstel_request_id:herstelId,
    }));
    const kandidaten=await p.bulk.ververs(objectId);
    expect(kandidaten).toEqual([{
      id:pipelineId,objectId,pipelineFase:'match_gevonden',
      interesseNiveau:'lauw',updatedAt:'2026-11-15T08:00:00.000001+00:00',
    }]);
    expect(a.from).toHaveBeenCalledWith('object_pipeline');
    expect(a.eq).toHaveBeenCalledWith('object_id',objectId);
    expect(a.is).toHaveBeenCalledWith('soft_deleted_at',null);
    const objectFase=await p.bulk.verversObjectFase!(objectId);
    expect(objectFase).toMatchObject({
      objectId,stageId:'b6000000-0000-4000-8000-000000000070',locked:false,
    });
    expect(a.from).toHaveBeenCalledWith('objecten');
    expect(a.getUser).toHaveBeenCalledTimes(4);
  });
  it('zonder ingelogde testgebruiker geen RPC en geen query',async()=>{
    const a=fakeClient();
    a.getUser.mockResolvedValue({data:{user:null},error:null});
    const p=maakGescheidenSupabaseTestClient(config,key,a.factory);
    await expect(p.bulk.ververs(objectId)).rejects.toMatchObject({code:'42501'});
    expect(a.rpc).not.toHaveBeenCalled();
    expect(a.from).not.toHaveBeenCalled();
  });
  it('verkeerde kandidaten uit een query blijven afgeschermd',async()=>{
    const a=fakeClient();
    a.is.mockResolvedValue({data:[{
      id:pipelineId,object_id:'b1000000-0000-4000-8000-000000000099',
      pipeline_fase:'match_gevonden',interesse_niveau:'lauw',
      updated_at:'2026-11-15T08:00:00+00:00',
    }],error:null});
    const p=maakGescheidenSupabaseTestClient(config,key,a.factory);
    await expect(p.bulk.ververs(objectId)).rejects.toThrow(/ander object/);
  });
});
