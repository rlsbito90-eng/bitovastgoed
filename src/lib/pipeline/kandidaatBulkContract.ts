import {
  INTERESSE_LABELS, PIPELINE_FASES, KANDIDAAT_NAAR_OBJECT_STAGE,
  type InteresseNiveau, type PipelineFase, type PipelineKandidaat,
} from '@/data/mock-data';
import { REACTIE_REDEN_LABELS, type ReactieReden } from '@/lib/relaties/aanbiedingsReacties';

/**
 * Contract voor de toekomstige transactionele RPC. Zuiver: geen fetch,
 * Supabase-import, databasewijziging of automatisch contactmoment.
 */
export type KandidaatBulkActie =
  | { type: 'fase'; fase: Exclude<PipelineFase, 'afgevallen'|'afgerond'> }
  | { type: 'interesse'; niveau: InteresseNiveau }
  | { type: 'afwijzen'; bron: 'intern'; categorie: ReactieReden; anders?: string };

type BronKandidaat = Pick<
  PipelineKandidaat, 'id' | 'objectId' | 'updatedAt' | 'pipelineFase'
>;
export interface KandidaatBulkVerzoek {
  p_object_id: string;
  p_request_id: string;
  p_items: { id: string; expected_updated_at: string }[];
  p_actie: KandidaatBulkActie;
}
export interface KandidaatBulkOpslagResultaat {
  verzoek_id: string;
  aangepast: number;
  ongewijzigd: number;
  wijzigingen: { id: string; updated_at: string }[];
  /** Optioneel: resultaat van de objectfase-verhoging binnen dezelfde DB-transactie. */
  object_fase_wijziging?: null | {
    object_id: string;
    oude_stage_id: string | null;
    nieuwe_stage_id: string;
    nieuwe_slug: string;
  };
}
/**
 * Alleen wanneer de bulkfase in de bronmapping staat, is Object-voortgang
 * toegestaan. Geen kandidaat kan een object in de eindfase zetten.
 */
export function verwachteObjectFaseBijBulk(actie: KandidaatBulkActie): string | null {
  return actie.type === 'fase' ? KANDIDAAT_NAAR_OBJECT_STAGE[actie.fase] ?? null : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Postgres/Supabase kan microseconden teruggeven. De invoer blijft exact
// behouden: Date.toISOString() zou 6 cijfers naar 3 cijfers afronden.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function bouwKandidaatBulkVerzoek(
  objectId: string,
  requestId: string,
  kandidaten: readonly BronKandidaat[],
  actie: KandidaatBulkActie,
): KandidaatBulkVerzoek {
  if (!UUID.test(objectId) || !UUID.test(requestId))
    throw new Error('Een geldig object-ID en nieuw verzoek-ID zijn verplicht.');
  if (kandidaten.length < 1 || kandidaten.length > 100)
    throw new Error('Selecteer 1 tot 100 kandidaten.');
  const gezien = new Set<string>();
  const p_items = kandidaten.map(k => {
    if (!UUID.test(k.id) || !UUID.test(k.objectId) || k.objectId.toLowerCase() !== objectId.toLowerCase())
      throw new Error('Een kandidaat hoort niet bij het geselecteerde object.');
    if (gezien.has(k.id.toLowerCase()))
      throw new Error('Dezelfde kandidaat is tweemaal geselecteerd.');
    gezien.add(k.id.toLowerCase());
    if (k.pipelineFase === 'afgevallen' || k.pipelineFase === 'afgerond')
      throw new Error('Afgevallen of afgeronde kandidaten kunnen niet in bulk worden gewijzigd.');
    if (!k.updatedAt || !TIMESTAMP.test(k.updatedAt) || !Number.isFinite(Date.parse(k.updatedAt)))
      throw new Error('Kandidaat mist een geldige databaseversie. Vernieuw de lijst.');
    return { id: k.id, expected_updated_at: k.updatedAt };
  });
  if (actie.type === 'fase') {
    if (!PIPELINE_FASES.some(f => f.key === actie.fase) ||
        ['afgevallen','afgerond'].includes(actie.fase))
      throw new Error('Deze pipelinefase is geen geldige bulkactie.');
  } else if (actie.type === 'interesse') {
    if (!Object.prototype.hasOwnProperty.call(INTERESSE_LABELS, actie.niveau))
      throw new Error('Ongeldig interesseniveau.');
  } else if (actie.type === 'afwijzen') {
    if (actie.bron !== 'intern')
      throw new Error('Een ontvangen kopersreactie moet afzonderlijk worden geregistreerd.');
    if (!Object.prototype.hasOwnProperty.call(REACTIE_REDEN_LABELS, actie.categorie))
      throw new Error('Kies één geldige afwijzingscategorie.');
    if (actie.categorie === 'anders' && !actie.anders?.trim())
      throw new Error('Licht de andere reden toe.');
    if ((actie.anders?.length ?? 0) > 500 ||
        (actie.categorie !== 'anders' && !!actie.anders?.trim()))
      throw new Error('Ongeldige aanvullende reden.');
  } else {
    throw new Error('Onbekende bulkactie.');
  }
  return { p_object_id: objectId, p_request_id: requestId, p_items, p_actie: actie };
}
