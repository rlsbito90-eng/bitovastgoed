import { verwachteObjectFaseBijBulk, type KandidaatBulkVerzoek, type KandidaatBulkOpslagResultaat } from './kandidaatBulkContract';

/**
 * Testbare adapter. De toekomstige CRM-client moet een expliciete poort aanleveren.
 * Deze module importeert bewust géén Supabase-client en voert zelf geen queries uit.
 */
export interface KandidaatBulkPoort<T> {
  opslaan(verzoek: KandidaatBulkVerzoek): Promise<KandidaatBulkOpslagResultaat>;
  ververs(objectId: string): Promise<T[]>;
}

export type BulkUitkomst<T> =
  | { status: 'opgeslagen'; resultaat: KandidaatBulkOpslagResultaat; kandidaten: T[] }
  | { status: 'opgeslagen_niet_ververst'; resultaat: KandidaatBulkOpslagResultaat; melding: string }
  | { status: 'conflict'; melding: string }
  | { status: 'geweigerd'; melding: string }
  | { status: 'onzeker'; melding: string; verzoek: KandidaatBulkVerzoek };

const integer=(value:unknown):value is number=>
  Number.isSafeInteger(value)&&typeof value==='number'&&value>=0;
export function controleerBulkResultaat(
  verzoek:KandidaatBulkVerzoek,
  data:unknown,
):KandidaatBulkOpslagResultaat {
  if (!data || typeof data!=='object') throw new Error('Ongeldige opslagrespons');
  const r=data as Partial<KandidaatBulkOpslagResultaat>;
  if (r.verzoek_id?.toLowerCase()!==verzoek.p_request_id.toLowerCase() ||
      !integer(r.aangepast) || !integer(r.ongewijzigd) ||
      r.aangepast+r.ongewijzigd!==verzoek.p_items.length ||
      !Array.isArray(r.wijzigingen) || r.wijzigingen.length!==r.aangepast)
    throw new Error('Onverwacht opslagresultaat: controleer dezelfde transactie opnieuw');
  const doelIds=new Set(verzoek.p_items.map(item=>item.id.toLowerCase()));
  const gezien=new Set<string>();
  for(const wijziging of r.wijzigingen) {
    if(!wijziging || typeof wijziging.id!=='string' || typeof wijziging.updated_at!=='string' ||
       !doelIds.has(wijziging.id.toLowerCase()) || gezien.has(wijziging.id.toLowerCase()) ||
       !Number.isFinite(Date.parse(wijziging.updated_at)))
      throw new Error('Onbetrouwbare gewijzigde kandidaat in opslagresultaat');
    gezien.add(wijziging.id.toLowerCase());
  }
  // Objectfase mag uitsluitend binnen een echte, gewijzigde faseactie vooruitgaan.
  const stageChange=r.object_fase_wijziging;
  if(stageChange !== undefined && stageChange !== null){
    const verwacht=verwachteObjectFaseBijBulk(verzoek.p_actie);
    const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
    if(!verwacht || r.aangepast===0 || typeof stageChange!=='object' ||
       typeof stageChange.object_id!=='string' ||
       stageChange.object_id.toLowerCase()!==verzoek.p_object_id.toLowerCase() ||
       !uuid.test(stageChange.nieuwe_stage_id) ||
       (stageChange.oude_stage_id!==null &&
          (typeof stageChange.oude_stage_id!=='string'||!uuid.test(stageChange.oude_stage_id))) ||
       stageChange.nieuwe_slug!==verwacht ||
       stageChange.oude_stage_id?.toLowerCase()===stageChange.nieuwe_stage_id.toLowerCase()
    ) throw new Error('Ongeldige automatische objectfase in bulkresultaat');
  }
  return r as KandidaatBulkOpslagResultaat;
}

/**
 * Bij onzekere netwerkuitval NOOIT een nieuw request-ID verzinnen.
 * De gebruiker mag uitsluitend exact dezelfde payload opnieuw aanbieden.
 * Bij bevestigde opslag en mislukte refresh juist NOOIT opnieuw opslaan.
 */
export async function voerBulkUit<T>(
  verzoek:KandidaatBulkVerzoek,
  poort:KandidaatBulkPoort<T>,
):Promise<BulkUitkomst<T>> {
  let resultaat:KandidaatBulkOpslagResultaat;
  try{
    resultaat=controleerBulkResultaat(verzoek,await poort.opslaan(verzoek));
  }catch(e){
    const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';
    if(code==='40001')return {
      status:'conflict',melding:'De gegevens zijn elders gewijzigd. Vernieuw de kandidatenlijst en controleer de selectie opnieuw.',
    };
    if(['42501','23503','23505','23514','22023'].includes(code))return {
      status:'geweigerd',melding:'De bulkactie is geweigerd ('+code+'). Er zijn geen wijzigingen doorgevoerd.',
    };
    return {
      status:'onzeker',melding:'De verbinding is onderbroken of de serverrespons klopt niet. Probeer uitsluitend hetzelfde verzoek opnieuw.',
      verzoek,
    };
  }
  try {
    const kandidaten=await poort.ververs(verzoek.p_object_id);
    return {status:'opgeslagen',resultaat,kandidaten};
  }catch{
    return {
      status:'opgeslagen_niet_ververst',resultaat,
      melding:'De wijziging is opgeslagen, maar het overzicht kon niet worden vernieuwd. Ververs de lijst; druk niet opnieuw op Opslaan.',
    };
  }
}
