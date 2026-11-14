import { supabase } from '@/integrations/supabase/client';
import {
  LEEG_BEOORDELING,valideerCommercieleBeoordeling,
  type ObjectCommercieleBeoordeling,
} from './commercieleBeoordeling';

const vanDb=(x:Record<string,any>):ObjectCommercieleBeoordeling=>({
  objectId:x.object_id,
  prijsOordeel:x.prijs_oordeel??LEEG_BEOORDELING.prijsOordeel,
  verkoopBereidheid:x.verkoop_bereidheid??LEEG_BEOORDELING.verkoopBereidheid,
  verkoopTermijn:x.verkoop_termijn??LEEG_BEOORDELING.verkoopTermijn,
  prijsFlexibiliteit:x.prijs_flexibiliteit??LEEG_BEOORDELING.prijsFlexibiliteit,
  beslisserStatus:x.beslisser_status??LEEG_BEOORDELING.beslisserStatus,
  eerderAangeboden:x.eerder_aangeboden??LEEG_BEOORDELING.eerderAangeboden,
  eerderAangebodenToelichting:x.eerder_aangeboden_toelichting??undefined,
  informatieStatus:x.informatie_status??LEEG_BEOORDELING.informatieStatus,
  internOordeel:x.intern_oordeel??undefined,
  besluit:x.besluit??undefined,
  besluitToelichting:x.besluit_toelichting??undefined,
  bijgewerktOp:x.bijgewerkt_op??undefined,
});

/** Alleen geautoriseerde CRM-gebruikers via bestaande intern-gebruiker RLS.
 * De aanvullende beoordeling wordt niet als openbaar objectveld opgeslagen.
 */
export async function laadCommercieleBeoordeling(
  objectId:string,
):Promise<ObjectCommercieleBeoordeling|null>{
  const {data,error}=await supabase
    .from('object_commerciele_beoordeling' as any)
    .select('*').eq('object_id',objectId).maybeSingle();
  if(error)throw new Error(error.message);
  return data ? vanDb(data as Record<string,any>):null;
}

export async function bewaarCommercieleBeoordeling(
  waarde:ObjectCommercieleBeoordeling,
):Promise<ObjectCommercieleBeoordeling>{
  const {objectId,bijgewerktOp:_,...rest}=waarde;
  const fout=valideerCommercieleBeoordeling(rest);
  if(fout)throw new Error(fout);
  const {data,error}=await supabase
    .from('object_commerciele_beoordeling' as any)
    .upsert({
      object_id:objectId,
      prijs_oordeel:waarde.prijsOordeel,
      verkoop_bereidheid:waarde.verkoopBereidheid,
      verkoop_termijn:waarde.verkoopTermijn,
      prijs_flexibiliteit:waarde.prijsFlexibiliteit,
      beslisser_status:waarde.beslisserStatus,
      eerder_aangeboden:waarde.eerderAangeboden,
      eerder_aangeboden_toelichting:waarde.eerderAangebodenToelichting?.trim()||null,
      informatie_status:waarde.informatieStatus,
      intern_oordeel:waarde.internOordeel?.trim()||null,
      besluit:waarde.besluit||null,
      besluit_toelichting:waarde.besluitToelichting?.trim()||null,
      bijgewerkt_op:new Date().toISOString(),
    } as any,{onConflict:'object_id'})
    .select('*').single();
  if(error)throw new Error(error.message);
  return vanDb(data as Record<string,any>);
}
