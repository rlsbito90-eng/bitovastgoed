import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {
  type Risicovoorkeur,type Risicotype,type Risicobereidheid,valideerRisicoInvoer,
} from '@/lib/relaties/risicovoorkeuren';

export type RisicovoorkeurInvoer = {
  risicotype:Risicotype;
  bereidheid:Risicobereidheid;
  bevestigd:boolean;
  bron:string|null;
  bronDatum:string|null;
  toelichting:string|null;
};

function uitDb(row:any):Risicovoorkeur{
  return {
    id:row.id,relatieId:row.relatie_id,risicotype:row.risicotype,
    bereidheid:row.bereidheid,bevestigd:row.bevestigd===true,
    bron:row.bron??null,bronDatum:row.bron_datum??null,
    toelichting:row.toelichting??null,updatedAt:row.updated_at??null,
  };
}

export function useRelatieRisicovoorkeuren(relatieId:string){
  const [voorkeuren,setVoorkeuren]=useState<Risicovoorkeur[]>([]);
  const [loading,setLoading]=useState(true);
  const [fout,setFout]=useState<string|null>(null);

  const refresh=useCallback(async()=>{
    if(!relatieId){setVoorkeuren([]);setLoading(false);return;}
    setLoading(true);
    const {data,error}=await supabase.from('relatie_risicovoorkeuren' as any)
      .select('*').eq('relatie_id',relatieId);
    if(error) {setFout(error.message);setVoorkeuren([]);}
    else {setVoorkeuren(((data??[]) as any[]).map(uitDb));setFout(null);}
    setLoading(false);
  },[relatieId]);

  useEffect(()=>{void refresh();},[refresh]);

  const bewaar=useCallback(async(input:RisicovoorkeurInvoer)=>{
    const validatie=valideerRisicoInvoer(
      input.risicotype,input.bereidheid,input.bevestigd,input.bron);
    if(validatie)throw new Error(validatie);
    const bestaand=voorkeuren.find(v=>v.risicotype===input.risicotype);
    const nu=new Date().toISOString();
    const row={
      relatie_id:relatieId,
      risicotype:input.risicotype,
      bereidheid:input.bereidheid,
      bevestigd:input.bevestigd,
      bron:input.bron?.trim()||null,
      bron_datum:input.bronDatum||null,
      toelichting:input.toelichting?.trim()||null,
      updated_at:nu,
    };
    const query=bestaand
      ? supabase.from('relatie_risicovoorkeuren' as any).update(row)
          .eq('id',bestaand.id).eq('relatie_id',relatieId)
      : supabase.from('relatie_risicovoorkeuren' as any).insert(row);
    const {data,error}=await query.select('*').single();
    if(error)throw error;
    if(!data)throw new Error('Opslaan niet bevestigd. Vernieuw het profiel.');
    const saved=uitDb(data);
    setVoorkeuren(prev=>[...prev.filter(x=>x.risicotype!==saved.risicotype),saved]);
    return saved;
  },[relatieId,voorkeuren]);

  const verwijder=useCallback(async(risicotype:Risicotype)=>{
    const bestaand=voorkeuren.find(v=>v.risicotype===risicotype);
    if(!bestaand)return;
    const {error}=await supabase.from('relatie_risicovoorkeuren' as any)
      .delete().eq('id',bestaand.id).eq('relatie_id',relatieId);
    if(error)throw error;
    setVoorkeuren(prev=>prev.filter(x=>x.id!==bestaand.id));
  },[relatieId,voorkeuren]);

  return {voorkeuren,loading,fout,refresh,bewaar,verwijder};
}

/** Eén gepagineerde leesactie per geopende kopersselectie, geen query per relatie. */
export function useMatchingRisicovoorkeuren(open:boolean) {
  const [state,setState] = useState<{voorkeuren:Risicovoorkeur[];loading:boolean;fout:string|null}>({
    voorkeuren:[],loading:true,fout:null,
  });
  useEffect(()=>{
    let actief=true;
    setState({voorkeuren:[],loading:true,fout:null});
    if (!open) return ()=>{actief=false;};
    async function laad(){
      try {
        const rows:Risicovoorkeur[]=[];
        const pageSize=500;
        for(let offset=0;;offset+=pageSize){
          const {data,error}=await supabase.from('relatie_risicovoorkeuren' as any)
            .select('*').order('id',{ascending:true}).range(offset,offset+pageSize-1);
          if(error) throw error;
          if(!actief) return;
          const page=(data??[]) as any[];
          rows.push(...page.map(uitDb));
          if(page.length<pageSize) break;
        }
        if(actief) setState({voorkeuren:rows,loading:false,fout:null});
      } catch {
        if(actief) setState({voorkeuren:[],loading:false,fout:'Risicovoorkeuren konden niet worden geladen. Open de selectie opnieuw.'});
      }
    }
    void laad();
    return ()=>{actief=false;};
  },[open]);
  return state;
}
