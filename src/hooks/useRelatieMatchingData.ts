import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type RendementStrategie = 'belegging'|'ontwikkeling'|'transformatie'|'handel'|'overig'|'onbekend';
export type RendementMethode = 'bar'|'nar'|'gdv_marge'|'projectkosten'|'eigen_vermogen'|'irr'|'netto_onbekend'|'overig'|'onbekend';
export type RendementType = 'minimum'|'doel'|'gemiddeld'|'historisch';

export interface Rendementscriterium {
  id: string;
  relatieId: string;
  zoekprofielId: string | null;
  strategie: RendementStrategie;
  methode: RendementMethode;
  percentage: number;
  criteriumType: RendementType;
  methodeBevestigd: boolean;
  status: 'actief'|'verouderd';
  toelichting: string | null;
  bron: string | null;
  bronDatum: string | null;
}

export type Rendementsinvoer = Pick<Rendementscriterium,
  'strategie'|'methode'|'percentage'|'criteriumType'|'methodeBevestigd'|'toelichting'|'bron'|'zoekprofielId'
>;
export interface RelatieObjectBesluit {
  id: string;
  relatieId: string;
  objectId: string;
  status: 'interessant' | 'afgewezen';
  redenCode: string | null;
  toelichting: string | null;
}

function criteriumUitDb(r: any): Rendementscriterium {
  return {
    id: r.id, relatieId: r.relatie_id, zoekprofielId: r.zoekprofiel_id ?? null,
    strategie:r.strategie, methode:r.methode, percentage:Number(r.percentage),
    criteriumType:r.criterium_type, methodeBevestigd:!!r.methode_bevestigd,
    status:r.status, toelichting:r.toelichting ?? null, bron:r.bron ?? null,
    bronDatum:r.bron_datum ?? null,
  };
}
function besluitUitDb(r: any): RelatieObjectBesluit {
  return {id:r.id,relatieId:r.relatie_id,objectId:r.object_id,status:r.status,
    redenCode:r.reden_code??null,toelichting:r.toelichting??null};
}

/** Relatie-scoped CR(U)D: geen wijzigingen in bestaande relatie- of zoekprofielvelden. */
export function useRelatieMatchingData(relatieId: string) {
  const [criteria,setCriteria] = useState<Rendementscriterium[]>([]);
  const [besluiten,setBesluiten] = useState<RelatieObjectBesluit[]>([]);
  const [loading,setLoading] = useState(true);
  const [fout,setFout] = useState<string|null>(null);

  const refresh = useCallback(async () => {
    if(!relatieId)return;
    setLoading(true);
    const [c,b] = await Promise.all([
      supabase.from('relatie_rendementscriteria' as any).select('*').eq('relatie_id',relatieId),
      supabase.from('relatie_object_matchbesluiten' as any).select('*').eq('relatie_id',relatieId),
    ]);
    if(c.error || b.error) {
      setFout((c.error??b.error)?.message ?? 'Gegevens niet beschikbaar');
    } else {
      setCriteria(((c.data??[]) as any[]).map(criteriumUitDb));
      setBesluiten(((b.data??[]) as any[]).map(besluitUitDb));
      setFout(null);
    }
    setLoading(false);
  },[relatieId]);

  useEffect(()=>{ void refresh(); },[refresh]);

  const bewaarCriterium=useCallback(async (input:Rendementsinvoer,id?:string) => {
    if(!Number.isFinite(input.percentage)||input.percentage<0||input.percentage>1000)
      throw new Error('Vul een geldig percentage in');
    const row={
      relatie_id:relatieId,zoekprofiel_id:input.zoekprofielId||null,
      strategie:input.strategie,methode:input.methode,percentage:input.percentage,
      criterium_type:input.criteriumType,methode_bevestigd:input.methodeBevestigd,
      toelichting:input.toelichting||null,bron:input.bron||null,updated_at:new Date().toISOString(),
    };
    const query=id
      ? supabase.from('relatie_rendementscriteria' as any).update(row).eq('id',id).eq('relatie_id',relatieId)
      : supabase.from('relatie_rendementscriteria' as any).insert(row);
    const {data,error}=await query.select('*').single();
    if(error)throw error;
    const saved=criteriumUitDb(data);
    setCriteria(prev=>[...prev.filter(x=>x.id!==saved.id),saved]);
    return saved;
  },[relatieId]);

  const verwijderCriterium=useCallback(async (id:string) => {
    const {error}=await supabase.from('relatie_rendementscriteria' as any)
      .update({status:'verouderd',updated_at:new Date().toISOString()})
      .eq('id',id).eq('relatie_id',relatieId);
    if(error)throw error;
    setCriteria(prev=>prev.map(x=>x.id===id?{...x,status:'verouderd'}:x));
  },[relatieId]);

  const beoordeelObject=useCallback(async (
    objectId:string,status:'interessant'|'afgewezen',redenCode?:string|null,toelichting?:string|null
  )=>{
    const {data,error}=await supabase.from('relatie_object_matchbesluiten' as any)
      .upsert({relatie_id:relatieId,object_id:objectId,status,
        reden_code:status==='afgewezen'?(redenCode||'overig'):null,
        toelichting:toelichting||null,updated_at:new Date().toISOString()},
        {onConflict:'relatie_id,object_id'}).select('*').single();
    if(error)throw error;
    const saved=besluitUitDb(data);
    setBesluiten(prev=>[...prev.filter(x=>x.objectId!==objectId),saved]);
  },[relatieId]);

  const wisObjectBeoordeling=useCallback(async (objectId:string)=>{
    const {error}=await supabase.from('relatie_object_matchbesluiten' as any)
      .delete().eq('relatie_id',relatieId).eq('object_id',objectId);
    if(error)throw error;
    setBesluiten(prev=>prev.filter(x=>x.objectId!==objectId));
  },[relatieId]);

  return {criteria,besluiten,loading,fout,refresh,bewaarCriterium,verwijderCriterium,
    beoordeelObject,wisObjectBeoordeling};
}
