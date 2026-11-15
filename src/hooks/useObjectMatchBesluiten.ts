import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MatchBesluitStatus } from '@/lib/matching/relatieObjectBesluiten';

export type ObjectBesluit = {status:MatchBesluitStatus;redenCode:string|null};
export type ObjectBesluiten = Record<string,ObjectBesluit>;

/** Eén gedeelde read/writebron voor de objectkant van de kandidaatselectie.
 * De handmatige relatieslijst en de matchsuggesties gebruiken exact deze staat.
 */
export function useObjectMatchBesluiten(objectId:string,enabled:boolean) {
  const [besluiten,setBesluiten]=useState<ObjectBesluiten>({});
  const [loading,setLoading]=useState(true);
  const [fout,setFout]=useState<string|null>(null);

  useEffect(()=>{
    if(!enabled || !objectId) {
      setBesluiten({});
      setLoading(true);
      setFout(null);
      return;
    }
    let actief=true;
    setLoading(true);
    setFout(null);
    setBesluiten({});
    void supabase.from('relatie_object_matchbesluiten' as any)
      .select('relatie_id,status,reden_code').eq('object_id',objectId)
      .then(({data,error})=>{
        if(!actief)return;
        if(error) {
          setFout('Eerdere beoordelingen kunnen niet worden geladen. Nieuwe kandidaten zijn tijdelijk geblokkeerd.');
        } else {
          const resultaat:ObjectBesluiten={};
          for(const row of (data??[]) as any[]) {
            resultaat[row.relatie_id]={status:row.status,redenCode:row.reden_code??null};
          }
          setBesluiten(resultaat);
        }
        setLoading(false);
      });
    return ()=>{actief=false;};
  },[enabled,objectId]);

  const beoordeel=useCallback(async(
    relatieId:string,status:MatchBesluitStatus,redenCode?:string|null,
  )=>{
    if(!enabled || loading || fout) throw new Error('Beoordelingen zijn nog niet beschikbaar');
    const reden=status==='afgewezen'?(redenCode??'overig'):null;
    const {error}=await supabase.from('relatie_object_matchbesluiten' as any)
      .upsert({object_id:objectId,relatie_id:relatieId,status,reden_code:reden,
        updated_at:new Date().toISOString()},{onConflict:'relatie_id,object_id'});
    if(error)throw error;
    setBesluiten(prev=>({...prev,[relatieId]:{status,redenCode:reden}}));
  },[objectId,enabled,loading,fout]);

  const herstel=useCallback(async(relatieId:string)=>{
    if(!enabled || loading || fout)throw new Error('Beoordelingen zijn nog niet beschikbaar');
    const {error}=await supabase.from('relatie_object_matchbesluiten' as any)
      .delete().eq('object_id',objectId).eq('relatie_id',relatieId);
    if(error)throw error;
    setBesluiten(prev=>{
      const next={...prev};
      delete next[relatieId];
      return next;
    });
  },[objectId,enabled,loading,fout]);

  return {besluiten,loading,fout,beoordeel,herstel};
}
