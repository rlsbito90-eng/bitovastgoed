import { supabase } from '@/integrations/supabase/client';
import type { AanbiedGolf,GolfSelectie } from './aanbiedGolven';

export async function laadAanbiedgolven(objectId:string):Promise<{
  golven:AanbiedGolf[];selecties:GolfSelectie[];
}>{
  const [g,s]=await Promise.all([
    supabase.from('object_aanbiedgolven' as any)
      .select('id,object_id,volgnummer,toelichting,aangemaakt_op')
      .eq('object_id',objectId).order('volgnummer',{ascending:true}),
    supabase.from('object_aanbiedgolf_selecties' as any)
      .select('id,golf_id,object_id,kandidaat_id,geselecteerd_op')
      .eq('object_id',objectId),
  ]);
  if(g.error)throw new Error(g.error.message);
  if(s.error)throw new Error(s.error.message);
  return {
    golven:(g.data??[]).map((x:any)=>({
      id:x.id,objectId:x.object_id,volgnummer:x.volgnummer,
      toelichting:x.toelichting??undefined,aangemaaktOp:x.aangemaakt_op,
    })),
    selecties:(s.data??[]).map((x:any)=>({
      id:x.id,golfId:x.golf_id,objectId:x.object_id,
      kandidaatId:x.kandidaat_id,geselecteerdOp:x.geselecteerd_op,
    })),
  };
}

/** Eén atomische DB-transactie met check op hetzelfde object en unieke
 * kandidaat. Selectie verstuurt niets en past geen pipelinefase aan.
 */
export async function maakNieuweAanbiedgolf(input:{
  objectId:string;kandidaatIds:string[];toelichting?:string;
}):Promise<string>{
  const {data,error}=await supabase.rpc('maak_aanbiedgolf' as any,{
    p_object_id:input.objectId,
    p_kandidaat_ids:input.kandidaatIds,
    p_toelichting:input.toelichting?.trim()||null,
  } as any);
  if(error)throw new Error(error.message);
  if(typeof data!=='string'||!data)
    throw new Error('Aanbiedgolf is niet bevestigd door de database.');
  return data;
}
