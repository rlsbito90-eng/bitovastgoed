import type { BriefEventInput, BriefEventType } from '@/lib/offMarket/brieven/events';
import type { Responsstatus } from '@/lib/offMarket/brieven/respons';

export type AcquisitieBron = 'off_market_radar' | 'vastgoedkansen';

export type AcquisitieEventCategorie =
  | 'onderzoek'
  | 'kadaster'
  | 'eigenaar'
  | 'communicatie'
  | 'respons'
  | 'opvolging'
  | 'workflow';

export type AcquisitieDomeinfeit =
  | 'brief_concept_aangemaakt'
  | 'brief_pdf_gegenereerd'
  | 'brief_geprint'
  | 'brief_ingepakt'
  | 'communicatie_verzonden'
  | 'emailtekst_gekopieerd'
  | 'reactie_ontvangen'
  | 'post_retour'
  | 'opvolging_aangemaakt'
  | 'opvolging_afgerond'
  | 'dossier_gearchiveerd';

export type CommunicatieKanaal = 'post' | 'email' | 'telefoon' | 'afspraak' | 'overig' | null;
export type ReactieSentiment = 'positief' | 'neutraal' | 'negatief' | 'onduidelijk' | null;

export interface AcquisitieEventProjectie {
  bron: AcquisitieBron;
  categorie: AcquisitieEventCategorie;
  feit: AcquisitieDomeinfeit;
  occurredAt: string | null;
  kanaal: CommunicatieKanaal;
  inbound: boolean;
  teltAlsVerzondenCommunicatie: boolean;
  teltAlsReactie: boolean;
  sentiment: ReactieSentiment;
  legacyEventType: BriefEventType;
  legacyStatus: string | null;
}

function bronVanBriefEvent(input: BriefEventInput): AcquisitieBron | null {
  const heeftSignaal = Boolean(input.signaal_id?.trim());
  const heeftVastgoedkans = Boolean(input.vastgoedkans_id?.trim());
  if (Number(heeftSignaal) + Number(heeftVastgoedkans) !== 1) return null;
  return heeftVastgoedkans ? 'vastgoedkansen' : 'off_market_radar';
}

function kanaalVanBriefEvent(input: BriefEventInput): CommunicatieKanaal {
  if (input.event_type === 'posted') return 'post';
  if (input.event_type === 'sent') {
    if (input.kanaal === 'email') return 'email';
    if (input.kanaal === 'post') return 'post';
    return 'overig';
  }
  if (input.kanaal === 'email' || input.kanaal === 'post') return input.kanaal;
  return null;
}

function sentimentVanResponsstatus(status?: string | null): ReactieSentiment {
  const respons = status as Responsstatus | undefined;
  if (respons === 'interesse' || respons === 'wil_meer_informatie' || respons === 'gesprek_gepland') {
    return 'positief';
  }
  if (
    respons === 'niet_geinteresseerd' ||
    respons === 'verkocht_of_niet_relevant' ||
    respons === 'afgevallen'
  ) {
    return 'negatief';
  }
  if (respons === 'reactie_ontvangen' || respons === 'later_opnieuw_benaderen') return 'neutraal';
  if (respons === 'verkeerd_adres' || respons === 'retour_post') return 'onduidelijk';
  return null;
}

/**
 * TRACK-1 semantische projectie bovenop het bestaande append-only briefeventlog.
 *
 * Belangrijk:
 * - dit schrijft niets naar de database;
 * - legacy eventtypen blijven ongewijzigd beschikbaar;
 * - exact één dossierbron is verplicht, gelijk aan de bestaande writer-invariant;
 * - `posted` en `sent` betekenen beide dat communicatie werkelijk verzonden is;
 * - `geen_reactie` is nooit een inbound reactie en wordt daarom niet als reactie geprojecteerd.
 */
export function projecteerBriefEventNaarAcquisitieEvent(
  input: BriefEventInput,
): AcquisitieEventProjectie | null {
  const bron = bronVanBriefEvent(input);
  if (!bron) return null;

  const basis = {
    bron,
    occurredAt: input.event_date ?? null,
    legacyEventType: input.event_type,
    legacyStatus: input.status ?? null,
  } as const;

  switch (input.event_type) {
    case 'concept_created':
      return { ...basis, categorie: 'communicatie', feit: 'brief_concept_aangemaakt', kanaal: null, inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'pdf_generated':
      return { ...basis, categorie: 'communicatie', feit: 'brief_pdf_gegenereerd', kanaal: null, inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'printed':
      return { ...basis, categorie: 'communicatie', feit: 'brief_geprint', kanaal: 'post', inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'enveloped':
      return { ...basis, categorie: 'communicatie', feit: 'brief_ingepakt', kanaal: 'post', inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'posted':
    case 'sent':
      return { ...basis, categorie: 'communicatie', feit: 'communicatie_verzonden', kanaal: kanaalVanBriefEvent(input), inbound: false, teltAlsVerzondenCommunicatie: true, teltAlsReactie: false, sentiment: null };
    case 'email_text_copied':
      return { ...basis, categorie: 'communicatie', feit: 'emailtekst_gekopieerd', kanaal: 'email', inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'response_received': {
      if (input.status === 'geen_reactie') return null;
      return { ...basis, categorie: 'respons', feit: 'reactie_ontvangen', kanaal: kanaalVanBriefEvent(input), inbound: true, teltAlsVerzondenCommunicatie: false, teltAlsReactie: true, sentiment: sentimentVanResponsstatus(input.status) ?? 'onduidelijk' };
    }
    case 'returned_mail':
      return { ...basis, categorie: 'respons', feit: 'post_retour', kanaal: 'post', inbound: true, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'follow_up_created':
      return { ...basis, categorie: 'opvolging', feit: 'opvolging_aangemaakt', kanaal: kanaalVanBriefEvent(input), inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'follow_up_completed':
      return { ...basis, categorie: 'opvolging', feit: 'opvolging_afgerond', kanaal: kanaalVanBriefEvent(input), inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    case 'archived':
      return { ...basis, categorie: 'workflow', feit: 'dossier_gearchiveerd', kanaal: null, inbound: false, teltAlsVerzondenCommunicatie: false, teltAlsReactie: false, sentiment: null };
    default:
      return null;
  }
}
