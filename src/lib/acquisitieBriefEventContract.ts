export type AcquisitieBriefDossierType = 'off_market_signaal' | 'vastgoedkans';

export type AcquisitieBriefEventType =
  | 'concept_created'
  | 'pdf_generated'
  | 'printed'
  | 'enveloped'
  | 'posted'
  | 'sent'
  | 'email_text_copied'
  | 'response_received'
  | 'returned_mail'
  | 'follow_up_created'
  | 'follow_up_completed'
  | 'archived';

export interface AcquisitieBriefDossierReferentie {
  dossierType: AcquisitieBriefDossierType;
  signaalId?: string | null;
  vastgoedkansId?: string | null;
}

export interface AcquisitieBriefEventInput extends AcquisitieBriefDossierReferentie {
  briefId?: string | null;
  relatieId?: string | null;
  geadresseerdeKey?: string | null;
  campagneStap?: string | null;
  briefNummer?: 1 | 2 | 3 | null;
  kanaal?: string | null;
  eventType: AcquisitieBriefEventType;
  eventDate?: string;
  status?: string | null;
  responsStatus?: string | null;
  responsUitkomst?: string | null;
  volgendeActie?: string | null;
  volgendeActieOp?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AcquisitieBriefEventRow {
  signaal_id: string | null;
  vastgoedkans_id: string | null;
  dossier_type: AcquisitieBriefDossierType;
  brief_id: string | null;
  relatie_id: string | null;
  geadresseerde_key: string | null;
  campagne_stap: string | null;
  brief_nummer: 1 | 2 | 3 | null;
  kanaal: string | null;
  event_type: AcquisitieBriefEventType;
  event_date?: string;
  status: string | null;
  respons_status: string | null;
  respons_uitkomst: string | null;
  volgende_actie: string | null;
  volgende_actie_op: string | null;
  metadata: Record<string, unknown>;
}

const schoon = (waarde?: string | null): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

export function valideerAcquisitieBriefDossierReferentie(
  referentie: AcquisitieBriefDossierReferentie,
): void {
  const signaalId = schoon(referentie.signaalId);
  const vastgoedkansId = schoon(referentie.vastgoedkansId);

  if (referentie.dossierType === 'off_market_signaal') {
    if (!signaalId || vastgoedkansId) {
      throw new Error('Off-Market-event vereist uitsluitend een signaalId.');
    }
    return;
  }

  if (!vastgoedkansId || signaalId) {
    throw new Error('Vastgoedkans-event vereist uitsluitend een vastgoedkansId.');
  }
}

export function naarAcquisitieBriefEventRow(
  input: AcquisitieBriefEventInput,
): AcquisitieBriefEventRow {
  valideerAcquisitieBriefDossierReferentie(input);

  return {
    signaal_id: input.dossierType === 'off_market_signaal' ? schoon(input.signaalId) : null,
    vastgoedkans_id: input.dossierType === 'vastgoedkans' ? schoon(input.vastgoedkansId) : null,
    dossier_type: input.dossierType,
    brief_id: schoon(input.briefId),
    relatie_id: schoon(input.relatieId),
    geadresseerde_key: schoon(input.geadresseerdeKey),
    campagne_stap: schoon(input.campagneStap),
    brief_nummer: input.briefNummer ?? null,
    kanaal: schoon(input.kanaal),
    event_type: input.eventType,
    ...(input.eventDate ? { event_date: input.eventDate } : {}),
    status: schoon(input.status),
    respons_status: schoon(input.responsStatus),
    respons_uitkomst: schoon(input.responsUitkomst),
    volgende_actie: schoon(input.volgendeActie),
    volgende_actie_op: schoon(input.volgendeActieOp),
    metadata: input.metadata ?? {},
  };
}
