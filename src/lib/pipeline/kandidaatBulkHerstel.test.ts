import {describe,expect,it,vi} from 'vitest';
import {
  bouwKandidaatBulkHerstelVerzoek,controleerBulkHerstelResultaat,voerBulkHerstelUit,
} from './kandidaatBulkHerstel';

const id='b1000000-0000-4000-8000-000000000001';
const bron='b4000000-0000-4000-8000-000000000009';
const herstel='b4000000-0000-4000-8000-000000000020';
const verzoek=bouwKandidaatBulkHerstelVerzoek(id,bron,herstel);
const resultaat={
  herstel_request_id:herstel,bron_request_id:bron,hersteld:2,
  wijzigingen:[
    {id:'b2000000-0000-4000-8000-000000000001',updated_at:'2026-11-15T13:00:00.000001Z'},
    {id:'b2000000-0000-4000-8000-000000000003',updated_at:'2026-11-15T13:00:00.000002Z'},
  ],
};
describe('Bulkherstel: bevestig eerst en bewaar hetzelfde verzoek-ID',()=>{
  it('bouwt een herstelverzoek met afzonderlijke bron en nieuw ID',()=>{
    expect(verzoek).toMatchObject({
      p_object_id:id,p_bron_request_id:bron,p_herstel_request_id:herstel,
    });
    expect(()=>bouwKandidaatBulkHerstelVerzoek(id,bron,bron)).toThrow(/nieuw verzoek/);
    expect(()=>bouwKandidaatBulkHerstelVerzoek('geen uuid',bron,herstel)).toThrow(/geldig/);
  });
  it('toont herstel uitsluitend na bevestigde serverrespons en refresh',async()=>{
    const herstellen=vi.fn().mockResolvedValue(resultaat);
    const ververs=vi.fn().mockResolvedValue([{id:'a',hersteld:true}]);
    const uitkomst=await voerBulkHerstelUit(verzoek,{herstellen,ververs});
    expect(uitkomst.status).toBe('hersteld');
    if(uitkomst.status==='hersteld')expect(uitkomst.kandidaten).toHaveLength(1);
    expect(herstellen).toHaveBeenCalledTimes(1);
    expect(ververs).toHaveBeenCalledWith(id);
  });
  it('netwerkuitval bewaart exact hetzelfde herstelverzoek voor retry',async()=>{
    const ververs=vi.fn();
    const uitkomst=await voerBulkHerstelUit(verzoek,{
      herstellen:async()=>{throw Error('netwerk weg na commit');},ververs,
    });
    expect(uitkomst.status).toBe('onzeker');
    if(uitkomst.status==='onzeker')expect(uitkomst.verzoek).toBe(verzoek);
    expect(ververs).not.toHaveBeenCalled();
  });
  it('na een versieconflict mag er geen stilzwijgende herstelstatus zijn',async()=>{
    const uitkomst=await voerBulkHerstelUit(verzoek,{
      herstellen:async()=>{throw {code:'40001'};},ververs:async()=>[],
    });
    expect(uitkomst.status).toBe('conflict');
  });
  it('een al eerder uitgevoerde bronactie mag niet dubbel worden hersteld',async()=>{
    const uitkomst=await voerBulkHerstelUit(verzoek,{
      herstellen:async()=>{throw {code:'23505'};},ververs:async()=>[],
    });
    expect(uitkomst.status).toBe('geweigerd');
  });
  it('bevestigd herstel blijft bevestigd ook wanneer herladen mislukt',async()=>{
    const uitkomst=await voerBulkHerstelUit(verzoek,{
      herstellen:async()=>resultaat,ververs:async()=>{throw Error('refresh timeout');},
    });
    expect(uitkomst.status).toBe('hersteld_niet_ververst');
  });
  it('valse succesresponsen en dubbele gewijzigde ID worden afgewezen',()=>{
    expect(()=>controleerBulkHerstelResultaat(verzoek,{
      ...resultaat,bron_request_id:'b4000000-0000-4000-8000-000000000100',
    })).toThrow(/klopt niet/);
    expect(()=>controleerBulkHerstelResultaat(verzoek,{
      ...resultaat,hersteld:2,wijzigingen:[resultaat.wijzigingen[0],resultaat.wijzigingen[0]],
    })).toThrow(/ongeldige kandidaat/);
    expect(()=>controleerBulkHerstelResultaat(verzoek,{
      ...resultaat,hersteld:0,wijzigingen:[],
    })).toThrow(/klopt niet/);
  });
});
