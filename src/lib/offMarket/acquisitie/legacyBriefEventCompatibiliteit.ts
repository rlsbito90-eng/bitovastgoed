import type { BriefEventType } from '@/lib/offMarket/brieven/events';

/** Via productie-export bevestigde kolommen van `off_market_brief_events`. */
export interface LegacyBriefEventRij {
  id: string;
  signaal_id: string;
  brief_id: string | null;
  geadresseerde_key: string | null;
  campagne_stap: string | null;
  kanaal: string | null;
  event_type: string;
  event_date: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export interface ProductieAuditReadmodel {
  eventId: string;
  signaalId: string;
  briefId: string | null;
  geadresseerdeKey: string | null;
  eventType: BriefEventType | 'onbekend_legacy_event';
  oorspronkelijkEventType: string;
  gebeurtenisOp: string;
  geregistreerdOp: string;
  geregistreerdDoor: string | null;
  campagneStap: string | null;
  kanaal: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
  bron: 'off_market_brief_events';
  waarschuwingen: string[];
}

const BEKENDE_EVENTTYPEN: ReadonlySet<BriefEventType> = new Set([
  'concept_created',
  'pdf_generated',
  'printed',
  'enveloped',
  'posted',
  'sent',
  'email_text_copied',
  'response_received',
  'returned_mail',
  'follow_up_created',
  'follow_up_completed',
  'archived',
]);

const BRIEFGEBONDEN_PRODUCTIE_EVENTS = new Set([
  'pdf_generated',
  'printed',
  'enveloped',
  'posted',
  'sent',
]);

function isBekendEventtype(value: string): value is BriefEventType {
  return BEKENDE_EVENTTYPEN.has(value as BriefEventType);
}

/**
 * Zet het bestaande append-only eventlog om naar een read-only auditmodel.
 * Onbekende historische waarden worden niet weggegooid of stil hernoemd.
 */
export function legacyBriefEventNaarProductieAudit(
  rij: LegacyBriefEventRij,
): ProductieAuditReadmodel {
  const waarschuwingen: string[] = [];
  const bekend = isBekendEventtype(rij.event_type);

  if (!bekend) {
    waarschuwingen.push(`Onbekend legacy-eventtype behouden: ${rij.event_type}`);
  }

  if (BRIEFGEBONDEN_PRODUCTIE_EVENTS.has(rij.event_type) && !rij.brief_id) {
    waarschuwingen.push(
      'Productiegebeurtenis heeft geen brief_id en kan niet hard aan één brief worden gekoppeld.',
    );
  }

  if ((rij.event_type === 'posted' || rij.event_type === 'sent') && !rij.geadresseerde_key) {
    waarschuwingen.push(
      'Verzendgebeurtenis mist geadresseerde_key; opvolging per geadresseerde blijft onzeker.',
    );
  }

  return {
    eventId: rij.id,
    signaalId: rij.signaal_id,
    briefId: rij.brief_id,
    geadresseerdeKey: rij.geadresseerde_key,
    eventType: bekend ? rij.event_type : 'onbekend_legacy_event',
    oorspronkelijkEventType: rij.event_type,
    gebeurtenisOp: rij.event_date,
    geregistreerdOp: rij.created_at,
    geregistreerdDoor: rij.created_by,
    campagneStap: rij.campagne_stap,
    kanaal: rij.kanaal,
    status: rij.status,
    metadata: rij.metadata ?? {},
    bron: 'off_market_brief_events',
    waarschuwingen,
  };
}

export function sorteerProductieAuditChronologisch(
  events: ProductieAuditReadmodel[],
): ProductieAuditReadmodel[] {
  return [...events].sort((a, b) => {
    const gebeurtenis = a.gebeurtenisOp.localeCompare(b.gebeurtenisOp);
    if (gebeurtenis !== 0) return gebeurtenis;
    const registratie = a.geregistreerdOp.localeCompare(b.geregistreerdOp);
    if (registratie !== 0) return registratie;
    return a.eventId.localeCompare(b.eventId);
  });
}
