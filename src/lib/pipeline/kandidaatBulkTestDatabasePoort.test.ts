import {describe,expect,it,vi} from 'vitest';
import {
  maakAparteTestDatabasePoort,valideerAparteTestDatabase,
  type TestDatabaseConfiguratie,type TestDatabaseTransport,
} from './kandidaatBulkTestDatabasePoort';
const testRef='bbbbbbbbbbbbbbbbbbbb';
const productieRef='vyjocdlwfxrblusfngfq';
const schaduwRef='xfygspvpeugxowxbcvnm';
const config:TestDatabaseConfiguratie={
  enabled:true,hostname:'bitovastgoed-git-crm-test-bitovastgoed.vercel.app',
  projectRef:testRef,projectUrl:'https://'+testRef+'.supabase.co',
  productieProjectUrl:'https://'+productieRef+'.supabase.co',
};
const objectId='b1000000-0000-4000-8000-000000000001';
const verzoek={
  p_object_id:objectId,p_request_id:'b4000000-0000-4000-8000-000000000002',
  p_items:[],p_actie:{type:'interesse' as const,niveau:'warm' as const},
};
const herstel={
  p_object_id:objectId,
  p_bron_request_id:'b4000000-0000-4000-8000-000000000002',
  p_herstel_request_id:'b4000000-0000-4000-8000-000000000003',
};
const maakTransport=()=>({
  identiteit:vi.fn().mockResolvedValue({id:'11111111-1111-1111-1111-111111111111'}),
  rpcOpslaan:vi.fn().mockResolvedValue({verzoek_id:verzoek.p_request_id,aangepast:0,ongewijzigd:0,wijzigingen:[]}),
  rpcHerstellen:vi.fn().mockResolvedValue({herstel_request_id:herstel.p_herstel_request_id,bron_request_id:herstel.p_bron_request_id,hersteld:1,wijzigingen:[]}),
  kandidatenLezen:vi.fn().mockResolvedValue([]),
  objectFaseLezen:vi.fn().mockResolvedValue({
    objectId,pipelineId:'b5000000-0000-4000-8000-000000000001',
    stageId:'b6000000-0000-4000-8000-000000000070',
    locked:false,updatedAt:'2026-11-15T13:30:00Z',
  }),
});
describe('CRM testproject: blokkeren tenzij een werkelijk gescheiden Auth + DB expliciet klaarstaat',()=>{
  it('weigert een uitgeschakelde testconfiguratie vóór client- of querygebruik',()=>{
    const transport=maakTransport();
    expect(()=>maakAparteTestDatabasePoort({...config,enabled:false},transport))
      .toThrow(/niet geactiveerd/);
    expect(transport.identiteit).not.toHaveBeenCalled();
    expect(transport.rpcOpslaan).not.toHaveBeenCalled();
  });
  it('blokkeert productiedomein en subdomeinvarianten',()=>{
    expect(()=>valideerAparteTestDatabase({...config,hostname:'crm.bitovastgoed.nl'}))
      .toThrow(/testhost/);
    expect(()=>valideerAparteTestDatabase({...config,hostname:'bitovastgoed-git-crm-test-bitovastgoed.vercel.app.fake.nl'}))
      .toThrow(/testhost/);
  });
  it('blokkeert zowel huidige productiedatabase als oude BAG-shadow',()=>{
    expect(()=>valideerAparteTestDatabase({...config,projectRef:productieRef,projectUrl:'https://'+productieRef+'.supabase.co'}))
      .toThrow(/afzonderlijke testprojectreferentie/);
    expect(()=>valideerAparteTestDatabase({...config,projectRef:schaduwRef,projectUrl:'https://'+schaduwRef+'.supabase.co'}))
      .toThrow(/afzonderlijke testprojectreferentie/);
  });
  it('weigert foutieve URL, poort, credentials, querystring of verwisselde URL',()=>{
    const bad=[
      'https://'+productieRef+'.supabase.co',
      'http://'+testRef+'.supabase.co',
      'https://'+testRef+'.supabase.co:9999',
      'https://user@'+testRef+'.supabase.co',
      'https://'+testRef+'.supabase.co/rest/v1',
      'https://'+testRef+'.supabase.co/?key=123',
    ];
    for(const projectUrl of bad)
      expect(()=>valideerAparteTestDatabase({...config,projectUrl})).toThrow();
  });
  it('laat een geldige maar niet ingelogde testgebruiker niets opslaan',async()=>{
    const transport=maakTransport();
    transport.identiteit.mockResolvedValue(null as never);
    const poort=maakAparteTestDatabasePoort(config,transport);
    await expect(poort.bulk.opslaan(verzoek)).rejects.toMatchObject({code:'42501'});
    expect(transport.rpcOpslaan).not.toHaveBeenCalled();
    expect(transport.kandidatenLezen).not.toHaveBeenCalled();
  });
  it('weigert anonieme ingelogde Auth-sessie',async()=>{
    const transport=maakTransport();
    transport.identiteit.mockResolvedValue({id:'11111111-1111-1111-1111-111111111111',isAnonymous:true});
    const poort=maakAparteTestDatabasePoort(config,transport);
    await expect(poort.bulk.opslaan(verzoek)).rejects.toMatchObject({code:'42501'});
    expect(transport.rpcOpslaan).not.toHaveBeenCalled();
  });
  it('stuurt alleen na de omgevings- en Auth-controle beide RPCs en leest actuele gegevens',async()=>{
    const transport=maakTransport();
    const poort=maakAparteTestDatabasePoort(config,transport);
    await poort.bulk.opslaan(verzoek);
    await poort.herstel.herstellen(herstel);
    await poort.bulk.ververs(objectId);
    expect(transport.rpcOpslaan).toHaveBeenCalledWith(verzoek);
    expect(transport.rpcHerstellen).toHaveBeenCalledWith(herstel);
    expect(transport.kandidatenLezen).toHaveBeenCalledWith(objectId);
    const objectFase=await poort.bulk.verversObjectFase!(objectId);
    expect(objectFase.stageId).toBe('b6000000-0000-4000-8000-000000000070');
    expect(transport.objectFaseLezen).toHaveBeenCalledWith(objectId);
    expect(transport.identiteit).toHaveBeenCalledTimes(4);
  });
  it('blokkeert cross-object kandidaten in een leesrespons',async()=>{
    const transport=maakTransport();
    transport.kandidatenLezen.mockResolvedValue([{
      id:'b2000000-0000-4000-8000-000000000001',
      objectId:'b1000000-0000-4000-8000-000000000099',
      pipelineFase:'match_gevonden',
      interesseNiveau:'lauw',
      updatedAt:'2026-11-15T08:00:00Z',
    }]);
    const poort=maakAparteTestDatabasePoort(config,transport);
    await expect(poort.bulk.ververs(objectId)).rejects.toThrow(/ander object/);
  });
  it('mismatch tussen staging-project en opgegeven productieproject blijft geblokkeerd',()=>{
    expect(()=>valideerAparteTestDatabase({
      ...config,productieProjectUrl:'https://'+testRef+'.supabase.co',
    })).toThrow(/dezelfde database/);
    expect(()=>valideerAparteTestDatabase({
      ...config,productieProjectUrl:'http://'+productieRef+'.supabase.co',
    })).toThrow(/productieproject-URL/);
  });
  it('weigert objectinformatie van een afwijkend object',async()=>{
    const t=maakTransport();
    t.objectFaseLezen.mockResolvedValue({
      objectId:'b1000000-0000-4000-8000-000000000099',
      pipelineId:null,stageId:null,locked:false,updatedAt:null,
    });
    const p=maakAparteTestDatabasePoort(config,t);
    await expect(p.bulk.verversObjectFase!(objectId)).rejects.toThrow(/ander object/);
  });
});
