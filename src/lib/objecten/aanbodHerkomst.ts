import { supabase } from '@/integrations/supabase/client';

export const OBJECT_PARTIJ_ROLLEN = {
  juridisch_eigenaar: 'Juridisch eigenaar',
  verkoper: 'Verkopende partij',
  aanbrenger: 'Aanbrenger',
  verkopend_makelaar: 'Verkopend makelaar',
  beheerder: 'Beheerder',
  adviseur: 'Adviseur',
  overig: 'Overige betrokken partij',
} as const;
export type ObjectPartijRol = keyof typeof OBJECT_PARTIJ_ROLLEN;

export const AANLEVER_KANALEN = {
  email: 'E-mail', telefoon: 'Telefoon', whatsapp: 'WhatsApp',
  website: 'Website', linkedin: 'LinkedIn', persoonlijk: 'Persoonlijk',
  via_makelaar: 'Via makelaar', anders: 'Anders', onbekend: 'Onbekend',
} as const;
export type AanleverKanaal = keyof typeof AANLEVER_KANALEN;

export type ObjectPartij = {
  id:string;objectId:string;relatieId:string;
  rol:ObjectPartijRol;betrokkenVanaf?:string;toelichting?:string;
  createdAt:string;
};
export type ObjectAanlevering = {
  id:string;objectId:string;relatieId:string;
  aangeleverdOp:string;kanaal:AanleverKanaal;
  toelichting?:string;createdAt:string;
};

function partijVanDb(x:any):ObjectPartij {
  return {
    id:x.id,objectId:x.object_id,relatieId:x.relatie_id,
    rol:x.rol,betrokkenVanaf:x.betrokken_vanaf??undefined,
    toelichting:x.toelichting??undefined,createdAt:x.created_at,
  };
}
function aanleveringVanDb(x:any):ObjectAanlevering{
  return {
    id:x.id,objectId:x.object_id,relatieId:x.relatie_id,
    aangeleverdOp:x.aangeleverd_op,kanaal:x.kanaal,
    toelichting:x.toelichting??undefined,createdAt:x.created_at,
  };
}

/** RLS restricted to authenticated internal users. Avoid loading these
 * sensitive relations into any public/off-market preview or exported IM.
 */
export async function laadObjectPartijen(objectId:string):Promise<ObjectPartij[]> {
  const {data,error}=await supabase.from('object_betrokken_partijen' as any)
    .select('id,object_id,relatie_id,rol,betrokken_vanaf,toelichting,created_at')
    .eq('object_id',objectId).order('created_at',{ascending:false});
  if(error)throw new Error(error.message);
  return (data??[]).map(partijVanDb);
}

export async function laadObjectAanleveringen(objectId:string):Promise<ObjectAanlevering[]>{
  const {data,error}=await supabase.from('object_aanlevermomenten' as any)
    .select('id,object_id,relatie_id,aangeleverd_op,kanaal,toelichting,created_at')
    .eq('object_id',objectId).order('aangeleverd_op',{ascending:false});
  if(error)throw new Error(error.message);
  return (data??[]).map(aanleveringVanDb);
}

export async function laadRelatiePartijen(relatieId:string):Promise<ObjectPartij[]>{
  const {data,error}=await supabase.from('object_betrokken_partijen' as any)
    .select('id,object_id,relatie_id,rol,betrokken_vanaf,toelichting,created_at')
    .eq('relatie_id',relatieId);
  if(error)throw new Error(error.message);
  return (data??[]).map(partijVanDb);
}

export async function laadRelatieAanleveringen(relatieId:string):Promise<ObjectAanlevering[]>{
  const {data,error}=await supabase.from('object_aanlevermomenten' as any)
    .select('id,object_id,relatie_id,aangeleverd_op,kanaal,toelichting,created_at')
    .eq('relatie_id',relatieId)
    .order('aangeleverd_op',{ascending:false});
  if(error)throw new Error(error.message);
  return (data??[]).map(aanleveringVanDb);
}

export async function registreerObjectPartij(input:{
  objectId:string;relatieId:string;rol:ObjectPartijRol;
  betrokkenVanaf?:string;toelichting?:string;
}):Promise<ObjectPartij>{
  const {data,error}=await supabase.from('object_betrokken_partijen' as any)
    .insert({
      object_id:input.objectId,relatie_id:input.relatieId,rol:input.rol,
      betrokken_vanaf:input.betrokkenVanaf||null,
      toelichting:input.toelichting?.trim()||null,
    } as any)
    .select('id,object_id,relatie_id,rol,betrokken_vanaf,toelichting,created_at').single();
  if(error)throw new Error(error.code==='23505'
    ? 'Deze relatie heeft deze rol al bij dit object.' : error.message);
  return partijVanDb(data);
}

export async function verwijderObjectPartij(id:string):Promise<void>{
  const {error}=await supabase.from('object_betrokken_partijen' as any)
    .delete().eq('id',id);
  if(error)throw new Error(error.message);
}

export async function registreerAanlevermoment(input:{
  objectId:string;relatieId:string;aangeleverdOp:string;
  kanaal:AanleverKanaal;toelichting?:string;
}):Promise<ObjectAanlevering>{
  const {data,error}=await supabase.from('object_aanlevermomenten' as any)
    .insert({
      object_id:input.objectId,relatie_id:input.relatieId,
      aangeleverd_op:input.aangeleverdOp,kanaal:input.kanaal,
      toelichting:input.toelichting?.trim()||null,
    } as any)
    .select('id,object_id,relatie_id,aangeleverd_op,kanaal,toelichting,created_at').single();
  if(error)throw new Error(error.message);
  return aanleveringVanDb(data);
}

export async function verwijderAanlevermoment(id:string):Promise<void>{
  const {error}=await supabase.from('object_aanlevermomenten' as any)
    .delete().eq('id',id);
  if(error)throw new Error(error.message);
}

/** Unieke dossiers tellen: oude directe verkoop-FK en nieuwe rollen worden
 * samengevoegd. Aanleveringen blijven apart geteld (meerdere per object).
 */
export function uniekeAanbodObjectIds(
  legacyObjectIds:readonly string[],
  rollen:readonly ObjectPartij[],
  aanleveringen:readonly ObjectAanlevering[],
):string[]{
  return [...new Set([
    ...legacyObjectIds,
    ...rollen.map(r=>r.objectId),
    ...aanleveringen.map(r=>r.objectId),
  ])];
}
