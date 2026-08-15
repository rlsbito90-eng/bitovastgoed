import type { KadasterKostenEventRow } from '@/lib/kadaster/databaseContract';
import type { AcquisitieBron } from './eventContract';

export type AcquisitieDomeinEventType =
  | 'kadaster_aangevraagd'
  | 'kadaster_geleverd'
  | 'kadaster_mislukt'
  | 'eigenaar_geidentificeerd'
  | 'brief_definitief_gemaakt'
  | 'batch_geprint'
  | 'communicatie_verzonden'
  | 'reactie_ontvangen'
  | 'opvolging_aangemaakt'
  | 'opvolging_afgerond';

export interface AcquisitieEntiteitRefs {
  vastgoedkansId?: string | null;
  signaalId?: string | null;
  objectId?: string | null;
  eigenaarId?: string | null;
  briefId?: string | null;
  briefVersieId?: string | null;
  batchId?: string | null;
  campagneId?: string | null;
}

export interface AcquisitieDomeinEvent {
  type: AcquisitieDomeinEventType;
  bron: AcquisitieBron | 'overig';
  occurredAt: string;
  refs: AcquisitieEntiteitRefs;
  actorId: string | null;
  externalReference: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
}

function acquisitieBronVanKadaster(module: string): AcquisitieDomeinEvent['bron'] {
  if (module === 'vastgoedkansen') return 'vastgoedkansen';
  if (module === 'off_market_radar') return 'off_market_radar';
  return 'overig';
}

/**
 * Read-only projectie van het bestaande Kadaster-kostenledger naar TRACK-feiten.
 * Alleen feitelijke aanvragen/leveringen/mislukkingen worden geprojecteerd.
 * Er wordt niets besteld en niets naar Supabase geschreven.
 */
export function projecteerKadasterKostenEventNaarAcquisitieEvent(
  event: KadasterKostenEventRow,
): AcquisitieDomeinEvent | null {
  let type: AcquisitieDomeinEventType;
  let occurredAt: string;

  if (event.status === 'geleverd' || event.status === 'gedeeltelijk_geleverd') {
    type = 'kadaster_geleverd';
    occurredAt = event.geleverd_op ?? event.aangevraagd_op;
  } else if (event.status === 'mislukt' || event.status === 'geannuleerd') {
    type = 'kadaster_mislukt';
    occurredAt = event.geleverd_op ?? event.aangevraagd_op;
  } else if (event.status === 'geraamd' || event.status === 'bevestigd') {
    type = 'kadaster_aangevraagd';
    occurredAt = event.aangevraagd_op;
  } else if (event.status === 'hergebruikt') {
    // Hergebruik is geen nieuwe betaalde aanvraag en mag KPI/kosten niet ophogen.
    return null;
  } else {
    return null;
  }

  return {
    type,
    bron: acquisitieBronVanKadaster(event.bron_module),
    occurredAt,
    refs: {
      vastgoedkansId: event.vastgoedkans_id,
      objectId: event.object_id ?? event.crm_objectregistratie_id,
      campagneId: event.campagne_id,
    },
    actorId: event.gebruiker_id,
    externalReference: event.externe_request_id,
    idempotencyKey: event.externe_request_id ? `kadaster:${event.externe_request_id}:${type}` : `kadaster-event:${event.id}:${type}`,
    metadata: {
      productCode: event.product_code,
      aantalEenheden: event.aantal_eenheden,
      geraamdeKosten: event.geraamde_kosten,
      werkelijkeKosten: event.werkelijke_kosten,
      valuta: event.valuta,
      adresLabel: event.adres_label,
      bronRecordId: event.bron_record_id,
      ...event.metadata,
    },
  };
}

export interface EigenaarGeidentificeerdInput {
  bron: AcquisitieBron;
  occurredAt: string;
  vastgoedkansId?: string | null;
  signaalId?: string | null;
  objectId?: string | null;
  eigenaarId?: string | null;
  actorId?: string | null;
  bronReferentie?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Contract voor het feit dat een eigenaar daadwerkelijk is vastgesteld.
 * Dit is bewust nog geen database-writer; TRACK-1 legt eerst de semantiek vast.
 */
export function maakEigenaarGeidentificeerdEvent(
  input: EigenaarGeidentificeerdInput,
): AcquisitieDomeinEvent | null {
  const heeftDossier = Number(Boolean(input.vastgoedkansId)) + Number(Boolean(input.signaalId)) === 1;
  if (!heeftDossier || !input.eigenaarId) return null;

  return {
    type: 'eigenaar_geidentificeerd',
    bron: input.bron,
    occurredAt: input.occurredAt,
    refs: {
      vastgoedkansId: input.vastgoedkansId ?? null,
      signaalId: input.signaalId ?? null,
      objectId: input.objectId ?? null,
      eigenaarId: input.eigenaarId,
    },
    actorId: input.actorId ?? null,
    externalReference: input.bronReferentie ?? null,
    idempotencyKey: `eigenaar:${input.eigenaarId}:${input.vastgoedkansId ?? input.signaalId}`,
    metadata: input.metadata ?? {},
  };
}
