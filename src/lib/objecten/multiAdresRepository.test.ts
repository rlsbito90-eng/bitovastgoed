import { describe, expect, it, vi } from 'vitest';
import {
  bewaarObjectAdressen, laadObjectAdressen, naarAdresPayload, valideerAdresConcept,
  type AdresConcept, type AdresRpcClient,
} from './multiAdresRepository';

const ID='a1000000-0000-4000-8000-000000000001';
const ADRES_ID='a2000000-0000-4000-8000-000000000001';
const etag='0123456789abcdef0123456789abcdef';
const base: AdresConcept={
  id:'legacy:'+ID,adres:'Geuzenweg 22A',postcode:'1211 AB',plaats:'Hilversum',
  provincie:'Noord-Holland',isHoofdadres:true,
};
const snapshot={
  etag, adressen:[{
    id:ADRES_ID,object_id:ID,adresregel:'Geuzenweg 22A',
    postcode:'1211 AB',plaats:'Hilversum',provincie:'Noord-Holland',
    is_hoofdadres:true,
  }],
};

describe('Opslagcontract meerdere adressen (geen echte netwerkcalls)',()=>{
  it('vormt een legacy adres om tot een nieuwe recordinvoer, zonder legacy data aan te passen',()=>{
    const payload=naarAdresPayload([base]);
    expect(payload[0].id).toBeUndefined();
    expect(payload[0].adresregel).toBe('Geuzenweg 22A');
    expect(base.id).toBe('legacy:'+ID);
  });
  it('behoudt echte adres-ID bij een bewerking',()=>{
    const payload=naarAdresPayload([{...base,id:ADRES_ID}]);
    expect(payload[0].id).toBe(ADRES_ID);
  });
  it('weigert dubbele, onvolledige of hoofdadresloze invoer',()=>{
    expect(valideerAdresConcept([base,{...base,id:'draft:1'}])).toMatch(/meerdere keren/);
    expect(valideerAdresConcept([{...base,plaats:''}])).toMatch(/verplicht/);
    expect(valideerAdresConcept([{...base,isHoofdadres:false}])).toMatch(/één hoofdadres/);
    expect(valideerAdresConcept([])).toMatch(/minimaal één/);
  });
  it('haalt een adresnapshot op en vertaalt deze naar het centrale adresmodel',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:snapshot,error:null});
    const result=await laadObjectAdressen({rpc} as AdresRpcClient,ID);
    expect(result.adressen[0]).toMatchObject({adres:'Geuzenweg 22A',objectId:ID,isHoofdadres:true});
    expect(rpc).toHaveBeenCalledWith('crm_object_adressen_snapshot',{p_object_id:ID});
  });
  it('stuurt een expliciete volledige adressenlijst met versiecode',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:snapshot,error:null});
    await bewaarObjectAdressen({rpc} as AdresRpcClient,ID,etag,[base]);
    expect(rpc).toHaveBeenCalledWith('crm_object_adressen_opslaan',{
      p_object_id:ID,p_expected_etag:etag,
      p_adressen:[{adresregel:'Geuzenweg 22A',postcode:'1211 AB',plaats:'Hilversum',
        provincie:'Noord-Holland',is_hoofdadres:true}],
    });
  });
  it('faalt lokaal vóór een RPC wanneer een adresinvoer onjuist is',async()=>{
    const rpc=vi.fn();
    await expect(bewaarObjectAdressen({rpc} as AdresRpcClient,ID,etag,[base,{...base,id:'draft:2'}]))
      .rejects.toThrow(/meerdere keren/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('blokkeert versieconflict en laat geen valse success-status zien',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'40001',message:'Conflict'}});
    await expect(bewaarObjectAdressen({rpc} as AdresRpcClient,ID,etag,[base]))
      .rejects.toThrow(/elders gewijzigd/);
  });
  it('weigert een snapshot die naar een ander object verwijst',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:{
      ...snapshot,adressen:[{...snapshot.adressen[0],object_id:'a1000000-0000-4000-8000-000000000002'}],
    },error:null});
    await expect(laadObjectAdressen({rpc} as AdresRpcClient,ID))
      .rejects.toThrow(/gegevensstructuur/);
  });
});
