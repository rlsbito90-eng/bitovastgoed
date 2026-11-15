import {fictieveKandidaten,pasFictieveBulkActieToe,type ProefKandidaat} from './kandidaatBulkProefModel';
import type {KandidaatBulkVerzoek,KandidaatBulkOpslagResultaat} from '@/lib/pipeline/kandidaatBulkContract';
import type {KandidaatBulkPoort} from '@/lib/pipeline/kandidaatBulkUitvoering';

export const DEMO_BULK_OBJECT_ID='b1000000-0000-4000-8000-000000000001';
export type DemoBulkKandidaat=ProefKandidaat&{objectId:string;updatedAt:string};
export interface DemoBulkAudit {
  kandidaatId:string;
  kandidaatNaam:string;
  actie:string;
  van:string;
  naar:string;
  bron:'intern'|null;
  categorie:string|null;
}
const kopie=(k:DemoBulkKandidaat):DemoBulkKandidaat=>({
  ...k,...(k.afwijzing?{afwijzing:{...k.afwijzing}}:{}),
});
const fout=(code:string,boodschap:string)=>Object.assign(new Error(boodschap),{code});

/**
 * Alleen in-memory en alleen bereikbaar vanuit de strikt geïsoleerde sandbox.
 * Geen Supabase, geen fetch, geen credentials en geen verbinding met CRM.
 */
export function maakFictieveBulkPoort(){
  let kandidaten:DemoBulkKandidaat[]=fictieveKandidaten().map((k,i)=>({
    ...k,
    id:'b2000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
    objectId:DEMO_BULK_OBJECT_ID,
    updatedAt:'2026-11-15T08:00:00.000001+00:00',
  }));
  let versie=1;
  let verbindingVerbrekenNaOpslag=false;
  const requests=new Map<string,{payload:string;resultaat:KandidaatBulkOpslagResultaat}>();
  const audit:DemoBulkAudit[]=[];
  const poort:KandidaatBulkPoort<DemoBulkKandidaat>={
    async opslaan(verzoek){
      if(verzoek.p_object_id!==DEMO_BULK_OBJECT_ID)throw fout('23503','Ander object');
      const key=verzoek.p_request_id.toLowerCase(),payload=JSON.stringify(verzoek);
      const bestaand=requests.get(key);
      if(bestaand){
        if(bestaand.payload!==payload)throw fout('23505','Verzoek-ID eerder anders gebruikt');
        return bestaand.resultaat;
      }
      if(!Array.isArray(verzoek.p_items)||verzoek.p_items.length<1||verzoek.p_items.length>100)
        throw fout('22023','Ongeldig aantal kandidaten');
      const ids=verzoek.p_items.map(item=>item.id);
      if(new Set(ids).size!==ids.length)throw fout('23505','Dubbele kandidaat');
      for(const item of verzoek.p_items){
        const k=kandidaten.find(c=>c.id===item.id);
        if(!k||k.objectId!==verzoek.p_object_id)throw fout('23503','Kandidaat onbekend');
        if(k.updatedAt!==item.expected_updated_at)
          throw fout('40001','Versieconflict');
        if(k.pipelineFase==='afgevallen'||k.pipelineFase==='afgerond')
          throw fout('23514','Gesloten kandidaat');
      }
      const uitkomst=pasFictieveBulkActieToe(kandidaten,new Set(ids),verzoek.p_actie);
      if(uitkomst.fout)throw fout('22023',uitkomst.fout);
      // De volledige validatie is voltooid voor de eerste mutatie.
      const wijzigingen:KandidaatBulkOpslagResultaat['wijzigingen']=[];
      const nieuweKandidaten=uitkomst.kandidaten.map(k=>{
        if(!uitkomst.gewijzigdeIds.includes(k.id))return {...k,objectId:DEMO_BULK_OBJECT_ID,updatedAt:kandidaten.find(x=>x.id===k.id)!.updatedAt};
        const updatedAt='2026-11-15T12:00:00.'+String(++versie).padStart(6,'0')+'+00:00';
        wijzigingen.push({id:k.id,updated_at:updatedAt});
        const old=kandidaten.find(x=>x.id===k.id)!;
        audit.push({
          kandidaatId:k.id,kandidaatNaam:k.naam,actie:verzoek.p_actie.type,
          van:old.pipelineFase+' / '+old.interesseNiveau,
          naar:k.pipelineFase+' / '+k.interesseNiveau,
          bron:verzoek.p_actie.type==='afwijzen'?'intern':null,
          categorie:verzoek.p_actie.type==='afwijzen'?verzoek.p_actie.categorie:null,
        });
        return {...k,objectId:DEMO_BULK_OBJECT_ID,updatedAt};
      });
      kandidaten=nieuweKandidaten;
      const resultaat={
        verzoek_id:verzoek.p_request_id,
        aangepast:uitkomst.aangepast,
        ongewijzigd:uitkomst.ongewijzigd,
        wijzigingen,
      };
      requests.set(key,{payload,resultaat});
      if(verbindingVerbrekenNaOpslag){
        verbindingVerbrekenNaOpslag=false;
        throw Error('Fictieve verbinding verbroken na commit');
      }
      return resultaat;
    },
    async ververs(objectId){
      if(objectId!==DEMO_BULK_OBJECT_ID)throw fout('23503','Ander object');
      return kandidaten.map(kopie);
    },
  };
  return {
    poort,
    huidigeLijst:()=>kandidaten.map(kopie),
    audit:()=>audit.map(x=>({...x})),
    simuleerWijzigingVanuitAnderTabblad:(id:string)=>{
      kandidaten=kandidaten.map(k=>k.id===id?{
        ...k,updatedAt:'2026-11-15T12:00:00.'+String(++versie).padStart(6,'0')+'+00:00',
      }:k);
    },
    verbreekVolgendeVerbindingNaOpslaan:()=>{verbindingVerbrekenNaOpslag=true;},
  };
}
