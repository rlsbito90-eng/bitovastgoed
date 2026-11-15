/**
 * Clientcontract voor auditbaar herstel van een volledig bulkverzoek.
 * Deze module bevat GEEN Supabase-client, browserfetch of automatische writes.
 * De backendfunctie wordt pas gekoppeld aan een aantoonbaar geïsoleerde database.
 */
export interface KandidaatBulkHerstelVerzoek {
  p_object_id: string;
  p_bron_request_id: string;
  p_herstel_request_id: string;
}
export interface KandidaatBulkHerstelResultaat {
  herstel_request_id: string;
  bron_request_id: string;
  hersteld: number;
  wijzigingen: { id: string; updated_at: string }[];
}
export interface KandidaatBulkHerstelPoort<T> {
  herstellen(verzoek: KandidaatBulkHerstelVerzoek): Promise<KandidaatBulkHerstelResultaat>;
  ververs(objectId: string): Promise<T[]>;
}
export type KandidaatBulkHerstelUitkomst<T> =
  | { status: 'hersteld'; resultaat: KandidaatBulkHerstelResultaat; kandidaten: T[] }
  | { status: 'hersteld_niet_ververst'; resultaat: KandidaatBulkHerstelResultaat; melding: string }
  | { status: 'conflict'; melding: string }
  | { status: 'geweigerd'; melding: string }
  | { status: 'onzeker'; melding: string; verzoek: KandidaatBulkHerstelVerzoek };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bouwKandidaatBulkHerstelVerzoek(
  objectId: string, bronRequestId: string, nieuwHerstelId: string,
): KandidaatBulkHerstelVerzoek {
  if (![objectId,bronRequestId,nieuwHerstelId].every(x=>UUID.test(x)))
    throw new Error('Een geldig object-, bron- en herstelverzoek-ID is verplicht.');
  if (bronRequestId.toLowerCase()===nieuwHerstelId.toLowerCase())
    throw new Error('Een herstelactie moet een nieuw verzoek-ID krijgen.');
  return {
    p_object_id: objectId,
    p_bron_request_id: bronRequestId,
    p_herstel_request_id: nieuwHerstelId,
  };
}

export function controleerBulkHerstelResultaat(
  verzoek: KandidaatBulkHerstelVerzoek, respons: unknown,
): KandidaatBulkHerstelResultaat {
  if (!respons || typeof respons!=='object') throw new Error('Ongeldige herstelrespons.');
  const r=respons as Partial<KandidaatBulkHerstelResultaat>;
  if (r.herstel_request_id?.toLowerCase()!==verzoek.p_herstel_request_id.toLowerCase() ||
      r.bron_request_id?.toLowerCase()!==verzoek.p_bron_request_id.toLowerCase() ||
      !Number.isSafeInteger(r.hersteld) || typeof r.hersteld!=='number' ||
      r.hersteld<1 || r.hersteld>100 ||
      !Array.isArray(r.wijzigingen) || r.wijzigingen.length!==r.hersteld)
    throw new Error('Herstelrespons klopt niet; controleer hetzelfde verzoek opnieuw.');
  const ids=new Set<string>();
  for(const wijziging of r.wijzigingen) {
    if (!wijziging || typeof wijziging.id!=='string' || !UUID.test(wijziging.id) ||
        typeof wijziging.updated_at!=='string' ||
        !Number.isFinite(Date.parse(wijziging.updated_at)) ||
        ids.has(wijziging.id.toLowerCase()))
      throw new Error('Herstelrespons bevat een ongeldige kandidaat.');
    ids.add(wijziging.id.toLowerCase());
  }
  return r as KandidaatBulkHerstelResultaat;
}

/**
 * Een onzeker serverresultaat kan al gecommit zijn: dezelfde request opnieuw.
 * Een bevestigd resultaat zonder refresh mag NIET opnieuw worden opgeslagen.
 */
export async function voerBulkHerstelUit<T>(
  verzoek: KandidaatBulkHerstelVerzoek,
  poort: KandidaatBulkHerstelPoort<T>,
): Promise<KandidaatBulkHerstelUitkomst<T>> {
  let resultaat: KandidaatBulkHerstelResultaat;
  try {
    resultaat=controleerBulkHerstelResultaat(verzoek,await poort.herstellen(verzoek));
  } catch(e) {
    const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';
    if(code==='40001')return {
      status:'conflict',melding:'Een kandidaat is na de oorspronkelijke actie aangepast. Er is niets hersteld. Controleer de actuele situatie.',
    };
    if(['42501','23503','23505','23514','22023'].includes(code))return {
      status:'geweigerd',melding:'Herstel is geweigerd ('+code+'). Controleer het bronverzoek en de kandidaatstatus.',
    };
    return {
      status:'onzeker',
      melding:'Het herstel kan al zijn uitgevoerd. Probeer uitsluitend hetzelfde herstelverzoek opnieuw.',
      verzoek,
    };
  }
  try {
    const kandidaten=await poort.ververs(verzoek.p_object_id);
    return {status:'hersteld',resultaat,kandidaten};
  } catch {
    return {
      status:'hersteld_niet_ververst',resultaat,
      melding:'Herstel is opgeslagen, maar de lijst kon niet worden vernieuwd. Ververs de kandidaten; voer geen tweede herstelactie uit.',
    };
  }
}
